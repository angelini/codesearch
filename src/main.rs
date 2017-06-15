#![feature(custom_derive, plugin)]
#![plugin(clippy)]
#![plugin(rocket_codegen)]

#![allow(needless_pass_by_value)] // rocket matchers trigger false positives

extern crate rocket;
extern crate serde;
extern crate serde_json;
extern crate rocket_contrib;
#[macro_use] extern crate serde_derive;

mod base;
mod ripgrep;

use base::{Project, Snippet};
use rocket::response::NamedFile;
use rocket_contrib::JSON;
use std::io;
use std::path::{Path, PathBuf};

fn project_from_id(id: usize) -> Project {
    match id {
        1 => Project::new(Path::new("/Users/alexangelini/src/github.com/angelini/codesearch")),
        2 => Project::new(Path::new("/Users/alexangelini/src/github.com/Shopify/starscream/starscream")),
        _ => panic!("unknown project_id"),
    }
}

#[derive(FromForm)]
struct SearchQuery {
    query: String,
    above: Option<usize>,
    below: Option<usize>,
}

#[get("/search/<project_id>?<query>")]
fn search(project_id: usize, query: SearchQuery) -> JSON<Vec<Snippet>> {
    let snippets = ripgrep::search(&project_from_id(project_id),
                                   &query.query,
                                   query.above.unwrap_or(2),
                                   query.below.unwrap_or(2));
    JSON(snippets)
}

#[derive(FromForm)]
struct FileQuery {
    file: String,
    query: String,
}

#[get("/file/<project_id>?<query>")]
fn file(project_id: usize, query: FileQuery) -> JSON<Snippet> {
    let snippet = ripgrep::file(&project_from_id(project_id),
                                &query.query,
                                &query.file);
    JSON(snippet)
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
    rocket::ignite().mount("/", routes![search, file, index, files]).launch();
}
