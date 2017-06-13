'use strict';

const MODE_LOOKUP = {
  'rs': 'rust'
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
        console.log(idx, match[0], match[1]);
        cm.doc.markText({line: idx, ch: match[0]},
                        {line: idx, ch: match[1]},
                        {className: 'highlight'});
      });
    });
  },
  template: `
<div>
  <textarea>{{ code }}</textarea>
</div>
`
});

Vue.component('search', {
  props: ['snippets'],
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
  methods: {
    emitSearch: function() {
      this.$emit('search-request', this.$el.querySelector('input').value);
    },
    emitFile: function(event) {
      console.log('emitting files', event.target.innerText);
      this.$emit('file-request', event.target.innerText);
    }
  },
  template: `
<div>
  <input v-on:keyup="emitSearch">
  <div v-for="group in grouped_snippets"
       v-bind:key="group[0].file.path">
    <div v-on:click="emitFile">{{ group[0].file.path }}</div>
    <source-block v-for="snippet in group"
                  v-bind:snippet="snippet"
                  v-bind:key="snippet.hash"></source-block>
  </div>
</div>
`
});

Vue.component('files', {
  props: ['snippets'],
  template: `
<div>
  <div>{{ snippets }}</div>
  <div v-for="snippet in snippets" v-key="snippet.path">
    <source-block v-bind:snippet="snippet"></source-block>
  </div>
</div>`
});

let app = new Vue({
  el: '#app',
  data: {
    files: {},
    snippets: []
  },
  methods: {
    search: function(query) {
      console.log(app.files);
      if (query.length < 3) {
        return;
      }
      xhr_get('search/2?query=' + encodeURIComponent(query), (results) => {
        app.snippets = results;
      }, (status) => console.err(status));
      _.each(_.keys(app.files), (file) => {
        console.log('file', file);
        xhr_get('file/2?file=' + encodeURIComponent(file) + '&query=' + encodeURIComponent(query),
                (snippet) => app.$set(app.files, file, snippet),
                (status) => console.err(status));
      });
    },
    addFile: function(file) {
      app.files[file] = {file: file, lines: [], line_number: 0};
    }
  }
});
