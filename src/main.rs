#![feature(custom_derive, plugin)]
#![plugin(clippy)]
#![plugin(rocket_codegen)]

#![allow(needless_pass_by_value)] // rocket matchers trigger false positives

extern crate rocket;
extern crate serde;
extern crate serde_json;
extern crate rocket_contrib;
#[macro_use] extern crate serde_derive;
extern crate toml;

mod base;
mod ripgrep;

use base::{FileSnippets, Project};
use rocket::State;
use rocket::response::NamedFile;
use rocket_contrib::JSON;
use std::collections::HashMap;
use std::fs::File;
use std::io;
use std::io::prelude::Read;
use std::path::{Path, PathBuf};

const RESULT_LIMIT: usize = 100;

#[derive(Debug, Deserialize, Serialize)]
struct Config {
    projects: HashMap<String, String>,
}

impl Config {
    fn project_from_name(&self, name: &str) -> Option<Project> {
        if let Some(path) = self.projects.get(name) {
            Some(Project::new(name, path))
        } else {
            None
        }
    }

    fn project_list(&self) -> Vec<Project> {
        self.projects.iter().map(|(name, path)| Project::new(name, path)).collect()
    }
}

fn read_config(path: &Path) -> Result<Config, io::Error> {
    let mut file = File::open(path)?;
    let mut contents = String::new();
    file.read_to_string(&mut contents)?;
    match toml::from_str(&contents) {
        Ok(config) => Ok(config),
        Err(parse_err) => Err(io::Error::new(io::ErrorKind::Other, parse_err))
    }
}

#[derive(FromForm)]
struct SearchQuery {
    query: String,
    file_filter: String,
    above: Option<usize>,
    below: Option<usize>,
}

#[derive(Debug, Deserialize, Serialize)]
struct SearchResponse {
    file_snippets: Vec<FileSnippets>,
    truncated: bool,
}

impl SearchResponse {
    fn new(mut snippets: Vec<FileSnippets>, limit: usize) -> SearchResponse {
        snippets.sort_by(|left, right| left.file.path.cmp(&right.file.path));
        if snippets.len() > limit {
            let truncated_snippets = snippets.into_iter()
                .enumerate()
                .map(|(idx, file_snippets)| {
                    if idx >= limit {
                        file_snippets.truncate()
                    } else {
                        file_snippets
                    }
                })
                .collect();
            SearchResponse {
                file_snippets: truncated_snippets,
                truncated: true,
            }
        } else {
            SearchResponse {
                file_snippets: snippets,
                truncated: false,
            }
        }
    }
}

#[get("/search/<project>?<query>")]
fn search(config: State<Config>, project: String, query: SearchQuery) -> io::Result<JSON<SearchResponse>> {
    let snippets = ripgrep::search(&config.project_from_name(&project).unwrap(),
                                   &query.query,
                                   &query.file_filter,
                                   query.above.unwrap_or(2),
                                   query.below.unwrap_or(2));
    Ok(JSON(SearchResponse::new(snippets?, RESULT_LIMIT)))
}

#[derive(FromForm)]
struct FileQuery {
    file: String,
    query: String,
}

#[get("/file/<project>?<query>")]
fn file(config: State<Config>, project: String, query: FileQuery) -> io::Result<JSON<FileSnippets>> {
    let snippet = ripgrep::file(&config.project_from_name(&project).unwrap(),
                                &query.query,
                                &query.file);
    Ok(JSON(snippet?))
}

#[get("/projects")]
fn projects(config: State<Config>) -> JSON<Vec<Project>> {
    JSON(config.project_list())
}

#[get("/")]
fn index() -> io::Result<NamedFile> {
    NamedFile::open("static/index.html")
}

#[get("/static/<file..>")]
fn files(file: PathBuf) -> Option<NamedFile> {
    NamedFile::open(Path::new("static/").join(file)).ok()
}

fn main() {
    let config = read_config(Path::new("config.toml"));
    rocket::ignite()
        .manage(config.unwrap())
        .mount("/", routes![search, file, projects, index, files]).launch();
}
