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

Vue.component('source-block', {
  props: ['snippet'],
  computed: {
    code: function() {
      return _.map(this.snippet.lines, (line) => line.full)
        .join('\n');
    }
  },
  mounted: function() {
    let line_number = this.snippet.line_number;
    let cm = CodeMirror.fromTextArea(this.$el.querySelector('textarea'), {
      lineNumbers: true,
      firstLineNumber: this.snippet.line_number,
      readOnly: true,
      mode: MODE_LOOKUP[this.snippet.file.extension],
    });
    _.each(this.snippet.lines, (line, idx) => {
      _.each(line.matches, (match) => {
        cm.doc.markText({line: idx, ch: match[0]},
                        {line: idx, ch: match[1]},
                        {className: 'highlight'});
      });
    });
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
      this.$emit('change-project', event.target.parentElement.querySelector('dt').innerText);
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

Vue.component('search', {
  props: ['snippets', 'projects'],
  computed: {
    grouped_snippets: function() {
      return _.chain(this.snippets)
        .groupBy((snippet) => snippet.file.path)
        .mapObject((snippets) => {
          return _.sortBy(snippets, (s) => s.line_number);
        })
        .values()
        .sortBy((group) => group[0].file.path)
        .value();
    }
  },
  data: function() {
    return {showProjectPicker: false};
  },
  methods: {
    emitSearch: function() {
      this.$emit('search-request', this.$el.querySelector('input').value);
    },
    emitFile: function(event) {
      this.$emit('file-request', event.target.innerText);
    },
    toggleProjectPicker: function() {
      this.showProjectPicker = !this.showProjectPicker;
    },
    changeProject: function(project) {
      this.showProjectPicker = false;
      this.$emit('change-project', project);
    }
  },
  template: `
<div>
  <header>
    <button v-on:click="toggleProjectPicker"
            class="project-toggle">+</button>
    <input v-on:keyup="emitSearch"
           class="search-input">
    <project-picker v-if="showProjectPicker"
                    v-bind:projects="projects"
                    v-on:change-project="changeProject"></project-picker>
  </header>
  <div v-for="(group, group_idx) in grouped_snippets"
       v-bind:key="group[0].file.path"
       class="box">
    <div v-on:click="emitFile" class="box-title">{{ group[0].file.path }}</div>
    <div v-if="group_idx < 10">
      <source-block v-for="(snippet, snippet_idx) in group"
                    v-if="snippet_idx < 3"
                    v-bind:snippet="snippet"
                    v-bind:key="snippet.hash"></source-block>
    </div>
  </div>
</div>
`
});

Vue.component('files', {
  props: ['snippets'],
  data: function() {
    return {selected: "", seen: []};
  },
  methods: {
    openFile: function(event) {
      this.selected = event.target.innerText;
    }
  },
  watch: {
    snippets: function() {
      let files = _.keys(this.snippets);
      let last = _.last(files);
      if (this.selected == "" && _.size(this.snippets) > 0) {
        this.selected = last;
      }
      if (!_.contains(this.seen, last)) {
        this.selected = last;
      }
      this.seen = _.keys(this.snippets);
    }
  },
  template: `
<div>
  <header class="tags">
    <div v-for="(_, file) in snippets"
         v-bind:key="file"
         v-bind:class="file == selected ? 'selected' : ''"
         v-on:click="openFile">{{ file }}</div>
  </header>
  <div v-for="snippet in snippets"
       v-if="snippet.file.path == selected"
       v-bind:key="snippet.hash"
       class="box">
    <div class="box-title"></div>
    <source-block v-bind:snippet="snippet"></source-block>
  </div>
</div>`
});

function buildSearchURI(project, query) {
  return 'search/' + project +
    '?query=' + encodeURIComponent(query);
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
    currentProject: null,
    projects: [],
    files: {},
    snippets: [],
  },
  methods: {
    search: function(query) {
      app.query = query;
      if (query.length < 3) {
        return;
      }
      xhr_get(buildSearchURI(app.currentProject, query),
              (results) => app.snippets = results,
              (status) => console.error('search', status));

      _.each(_.keys(app.files), (file) => {
        xhr_get(buildFileURI(app.currentProject, file, query),
                (snippet) => app.$set(app.files, file, snippet),
                (status) => console.error('file', status));
      });
    },
    addFile: function(file) {
      xhr_get(buildFileURI(app.currentProject, file, app.query),
              (snippet) => app.$set(app.files, file, snippet),
              (status) => console.error('file', status));
    },
    changeProject: function(project) {
      console.log('project', project);
      app.query = '';
      app.currentProject = project;
      app.files = {};
      app.snippets = [];
    }
  }
});

xhr_get('/projects',
        (projects) => {
          app.currentProject = projects[0].name;
          app.projects = projects;
        },
        (status) => console.error('projects', status));

addEventListener('keydown', function(event) {
  if (event.code == 'Space' && event.ctrlKey) {
    document.querySelector('.search-input').focus();
  }
});

document.querySelector('.search-input').focus();
