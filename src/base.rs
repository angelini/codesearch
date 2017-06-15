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
pub struct Snippet {
    pub lines: Vec<Line>,
    pub line_number: usize,
    pub file: FileRef,
    pub hash: u64,
}

impl Snippet {
    pub fn new(lines: Vec<Line>, line_number: usize, file: FileRef) -> Snippet {
        let mut hasher = DefaultHasher::new();
        for line in &lines {
            line.hash(&mut hasher);
        }
        Snippet {
            lines: lines,
            line_number: line_number,
            file: file,
            hash: hasher.finish(),
        }
    }
}

#[derive(Debug, Deserialize, Hash, Serialize)]
pub struct Line {
    pub full: String,
    pub matches: Vec<(usize, usize)>,
}

impl Line {
    pub fn new(full: String, matches: Vec<(usize, usize)>) -> Line {
        Line { full, matches }
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
