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

Vue.component('search-result-group', {
  props: ['group', 'expanded'],
  computed: {
    file: function() {
      return this.group[0].file.path;
    }
  },
  data: function() {
    return {toShow: this.expanded ? 3 : 0};
  },
  methods: {
    emitFile: function() {
      this.$emit('file-request', this.file);
    },
    showMore: function() {
      this.toShow += 3;
    }
  },
  template: `
<div class="box">
  <div v-on:click="emitFile" class="box-title">{{ file }}</div>
  <source-block v-for="(snippet, snippet_idx) in group"
                v-if="snippet_idx < toShow"
                v-bind:snippet="snippet"
                v-bind:key="snippet.hash"></source-block>
  <div v-if="group.length > toShow"
       v-on:click="showMore"
       class="rest">...</div>
</div>
`
});

Vue.component('search', {
  props: ['snippets', 'projects', 'currentProject'],
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
    <button v-on:click="toggleProjectPicker"
            class="project-toggle">+</button>
    <span class="italic">{{ currentProject }}</span>
    <input v-on:keyup="emitSearch"
           type="text"
           class="search-input">
    <project-picker v-if="showProjectPicker"
                    v-bind:projects="projects"
                    v-on:change-project="changeProject"></project-picker>
  </header>
  <search-result-group v-for="(group, group_idx) in grouped_snippets"
                       v-bind:key="group[0].hash"
                       v-bind:group="group"
                       v-bind:expanded="group_idx < 10"
                       v-on:file-request="emitFile"></search-result-group>
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
          let sorted = _.sortBy(projects, (project) => project.name);
          app.currentProject = sorted[0].name;
          app.projects = sorted;
        },
        (status) => console.error('projects', status));

addEventListener('keydown', function(event) {
  if (event.code == 'Space' && event.ctrlKey) {
    document.querySelector('.search-input').focus();
  }
});

document.querySelector('.search-input').focus();
