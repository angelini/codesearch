'use strict';

const MODE_LOOKUP = {
  'java': 'text/x-java',
  'js': 'javascript',
  'py': 'python',
  'rs': 'rust',
  'scala': 'text/x-scala',
};

function xhr_get(uri, success, error) {
  let xhr = new XMLHttpRequest();
  xhr.open('GET', uri);
  xhr.onload = function() {
    if (xhr.status === 200) {
      success(JSON.parse(xhr.responseText));
    }
    else {
      error(xhr.status);
    }
  };
  xhr.send();
}

function idx_xhr_get(idx, uri, success, error) {
  xhr_get(uri, (result) => success(idx, result), error);
}

Vue.component('source-block', {
  props: ['snippet', 'extension'],
  computed: {
    code: function() {
      return _.map(this.snippet.lines, (line) => line.full)
        .join('\n');
    }
  },
  data: function() {
    return {cm: null};
  },
  methods: {
    highlightMatches: function() {
      this.cm.operation(() => {
        _.each(this.cm.doc.getAllMarks(), (mark) => mark.clear());
        _.each(this.snippet.lines, (line, idx) => {
          _.each(line.matches, (match) => {
            this.cm.doc.markText({line: idx, ch: match[0]},
                                 {line: idx, ch: match[1]},
                                 {className: 'highlight'});
          });
        });
      });
    }
  },
  mounted: function() {
    let line_number = this.snippet.line_number;
    let cm = CodeMirror.fromTextArea(this.$el.querySelector('textarea'), {
      lineNumbers: true,
      firstLineNumber: this.snippet.line_number,
      readOnly: true,
      mode: MODE_LOOKUP[this.extension],
    });
    this.cm = cm;
    this.highlightMatches();
  },
  updated: function() {
    this.highlightMatches();
  },
  template: `
<div class="box-item">
  <textarea>{{ code }}</textarea>
</div>
`
});

Vue.component('project-picker', {
  props: ['projects'],
  methods: {
    emitProject: function(event) {
      var dl;
      if (event.target.tagName == 'DL') {
        dl = event.target;
      } else {
        dl = event.target.parentElement;
      }
      this.$emit('change-project', dl.querySelector('dt').innerText);
    }
  },
  template: `
<div class="dropdown">
  <dl v-for="project in projects"
      v-bind:key="project.name"
      v-on:click="emitProject">
    <dt>{{ project.name }}</dt>
    <dd>{{ project.path }}</dd>
  </dl>
</div>
`
});

Vue.component('search-result-group', {
  props: ['fileSnippets', 'expanded', 'idx'],
  data: function() {
    return {toShow: this.expanded ? 3 : 0};
  },
  methods: {
    emitFile: function() {
      this.$emit('file-request', this.fileSnippets.file.path);
    },
    showMore: function() {
      this.toShow += 3;
    }
  },
  watch: {
    expanded: function() {
      if (this.expanded && this.toShow < 3) {
        this.toShow = 3;
      }
      if (!this.expanded && this.toShow > 0) {
        this.toShow = 0;
      }
    }
  },
  template: `
<div class="box">
  <div>{{ idx }}</div>
  <div v-on:click="emitFile" class="box-title">{{ fileSnippets.file.path }}</div>
  <source-block v-for="(snippet, snippet_idx) in fileSnippets.snippets"
                v-if="snippet_idx < toShow"
                v-bind:snippet="snippet"
                v-bind:extension="fileSnippets.file.extension"
                v-bind:key="snippet.hash"></source-block>
  <div v-if="fileSnippets.snippets.length > toShow"
       v-on:click="showMore"
       class="rest">...</div>
</div>
`
});

Vue.component('search', {
  props: ['searchResponse', 'projects', 'currentProject'],
  computed: {
    fileCount: function() {
      return _.size(this.searchResponse.file_snippets);
    },
    matchCount: function() {
      return _.reduce(this.searchResponse.file_snippets,
                      (acc, snippets) => acc + snippets.match_count,
                      0);
    }
  },
  data: function() {
    return {showProjectPicker: false};
  },
  methods: {
    emitSearch: function(event) {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Control', 'Meta', 'Shift'].includes(event.key)) {
        return;
      }
      let inputs = this.$el.querySelectorAll('input');
      this.$emit('search-request', inputs[0].value, inputs[1].value);
    },
    emitFile: function(file) {
      this.$emit('file-request', file);
    },
    toggleProjectPicker: function() {
      this.showProjectPicker = !this.showProjectPicker;
    },
    changeProject: function(project) {
      this.showProjectPicker = false;
      if (project != this.currentProject) {
        this.$emit('change-project', project);
      }
    }
  },
  template: `
<div>
  <header>
    <div>
      <button v-on:click="toggleProjectPicker"
              class="project-toggle">></button>
      <span class="label">{{ currentProject }}</span>
      <input v-on:keyup="emitSearch"
             type="text"
             class="search-input">
      <span>{{ matchCount }}</span>
    </div>
    <div>
      <div class="project-toggle"></div>
      <span class="label grey">file filter</span>
      <input v-on:keyup="emitSearch"
             type="text">
      <span>{{ fileCount }}</span>
    </div>
    <project-picker v-if="showProjectPicker"
                    v-bind:projects="projects"
                    v-on:change-project="changeProject"></project-picker>
  </header>
  <search-result-group v-for="(fileSnippets, idx) in searchResponse.file_snippets"
                       v-bind:key="fileSnippets.file.path"
                       v-bind:file-snippets="fileSnippets"
                       v-bind:expanded="idx < 10"
                       v-on:file-request="emitFile"></search-result-group>
</div>
`
});

Vue.component('files', {
  props: ['files'],
  data: function() {
    return {selected: '', seen: []};
  },
  methods: {
    basename: function(file_path) {
      return _.last(file_path.split('/'));
    },
    openFile: function(event) {
      if (event.target.innerText == 'x') {
        return;
      }
      this.selected = event.currentTarget
        .querySelectorAll('span')[1]
        .dataset
        .path;
    },
    closeFile: function(event) {
      let file = event.currentTarget.parentElement
          .querySelectorAll('span')[1]
          .dataset
          .path;
      this.$emit('close-file', file);
    }
  },
  watch: {
    files: function() {
      let files = _.keys(this.files);
      let last = _.last(files);
      if (this.selected == "" && files.length > 0
          || !_.contains(this.seen, last)
          || !_.contains(files, this.selected)) {
        this.selected = last;
      }
      this.seen = _.keys(this.fileSnippets);
    }
  },
  template: `
<div>
  <header class="tags">
    <div v-for="(_, file) in files"
         v-bind:key="file"
         v-bind:class="file == selected ? 'selected' : ''"
         v-on:click="openFile">
      <span class="close" v-on:click="closeFile">x</span><span v-bind:data-path="file">{{ basename(file) }}</span>
    </div>
  </header>
  <div v-for="(file_snippets, file) in files"
       v-if="file == selected"
       v-bind:key="file_snippets.snippets[0].hash"
       class="box">
    <div class="box-title"></div>
    <source-block v-bind:snippet="file_snippets.snippets[0]"
                  v-bind:extension="file_snippets.file.extension"></source-block>
  </div>
</div>`
});

function buildSearchURI(project, query, fileFilter) {
  return 'search/' + project +
    '?query=' + encodeURIComponent(query) +
    '&file_filter=' + encodeURIComponent(fileFilter);
}

function buildFileURI(project, file, query) {
  return 'file/' + project +
    '?file=' + encodeURIComponent(file) +
    '&query=' + encodeURIComponent(query);
}

let app = new Vue({
  el: '#app',
  data: {
    query: '',
    fileFilter: '',
    currentProject: null,
    projects: [],
    files: {},
    searchResponse: {file_snippets: [], truncated: false},
    requestIndexes: {search: 0, file: 0},
  },
  methods: {
    nextId: function(key) {
      return this.requestIndexes[key] += 1;
    },
    search: function(query, fileFilter) {
      app.query = query;
      app.fileFilter = fileFilter;
      if (query.length < 3) {
        return;
      }

      idx_xhr_get(app.nextId('search'), buildSearchURI(app.currentProject, query, fileFilter),
              (idx, response) => {
                if (idx == app.requestIndexes.search) {
                  app.searchResponse = response;
                  app.requestIndexes.search = idx;
                }
              },
              (status) => console.error('search', status));

      _.each(_.keys(app.files), (file) => {
        xhr_get(buildFileURI(app.currentProject, file, query),
                (file_snippets) => app.$set(app.files, file, file_snippets),
                (status) => console.error('file', status));
      });
    },
    addFile: function(file) {
      xhr_get(buildFileURI(app.currentProject, file, app.query),
              (file_snippets) => {
                app.$set(app.files, file, file_snippets);
              },
              (status) => console.error('file', status));
    },
    closeFile: function(file) {
      app.$delete(app.files, file);
    },
    changeProject: function(project) {
      app.currentProject = project;
      app.files = {};
      app.searchResponse = {file_snippets: [], truncated: false};
      if (app.query != '') {
        app.search(app.query, app.fileFilter);
      }
      localStorage.setItem('project', project);
    }
  }
});

xhr_get('/projects',
        (projects) => {
          let sorted = _.sortBy(projects, (project) => project.name);
          app.projects = sorted;
          if ('project' in localStorage) {
            app.currentProject = localStorage['project'];
          } else {
            app.currentProject = sorted[0].name;
          }
        },
        (status) => console.error('projects', status));

addEventListener('keydown', function(event) {
  if (event.code == 'Space' && event.ctrlKey) {
    document.querySelector('.search-input').focus();
  }
});

document.querySelector('.search-input').focus();
