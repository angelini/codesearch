use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Project {
    pub name: String,
    pub path: PathBuf,
}

impl Project {
    pub fn new(name: &str, path: &str) -> Project {
        Project {
            name: String::from(name),
            path: PathBuf::from(path),
        }
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct FileRef {
    pub name: String,
    pub path: PathBuf,
    pub extension: String,
    pub project: Project,
}

impl FileRef {
    pub fn new(project: &Project, path: &str) -> FileRef {
        let path_buf = PathBuf::from(path);
        FileRef {
            name: path_name(path_buf.as_path()),
            extension: extension(path_buf.as_path()),
            path: path_buf,
            project: project.clone(),
        }
    }
}

#[derive(Debug, Deserialize, Serialize)]
pub struct Line {
    pub full: String,
    pub matches: Vec<(usize, usize)>,
}

impl Line {
    pub fn new(full: String, matches: Vec<(usize, usize)>) -> Line {
        Line { full, matches }
    }
}

#[derive(Debug, Deserialize, Serialize)]
pub struct Snippet {
    pub lines: Vec<Line>,
    pub line_number: usize,
    pub hash: u64,
}

impl Snippet {
    pub fn new(lines: Vec<Line>, line_number: usize) -> Snippet {
        let mut hasher = DefaultHasher::new();
        for line in &lines {
            line.full.hash(&mut hasher);
        }
        Snippet {
            lines: lines,
            line_number: line_number,
            hash: hasher.finish(),
        }
    }
}

#[derive(Debug, Deserialize, Serialize)]
pub struct FileSnippets {
    pub file: FileRef,
    pub snippets: Vec<Snippet>,
    pub match_count: usize,
    pub truncated: bool,
}

impl FileSnippets {
    pub fn new(file: FileRef, mut snippets: Vec<Snippet>) -> FileSnippets {
        let match_count = snippets.iter()
            .map(|snippet| snippet.lines.iter().fold(0, |acc, l| acc + l.matches.len()))
            .sum();
        snippets.sort_by(|left, right| left.line_number.cmp(&right.line_number));
        FileSnippets {file, snippets, match_count, truncated: false}
    }

    pub fn truncate(&self) -> FileSnippets {
        FileSnippets {
            file: self.file.clone(),
            snippets: vec![],
            match_count: self.match_count,
            truncated: true
        }
    }
}

fn path_name(path: &Path) -> String {
    path.file_name()
        .expect("cannot read file_name")
        .to_str()
        .expect("cannot utf parse path name")
        .to_string()
}

fn extension(path: &Path) -> String {
    if let Some(extension) = path.extension() {
        extension
            .to_str()
            .expect("cannot utf parse path name")
            .to_string()
    } else {
        String::from("")
    }
}
