'use strict';

const MODE_LOOKUP = {
  'rs': 'rust',
  'py': 'python',
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
      this.$emit('file-request', event.target.innerText);
    }
  },
  template: `
<div>
  <header>
    <input v-on:keyup="emitSearch" class="search-input">
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

let app = new Vue({
  el: '#app',
  data: {
    query: "",
    files: {},
    snippets: []
  },
  methods: {
    search: function(query) {
      app.query = query;
      if (query.length < 3) {
        return;
      }
      xhr_get('search/starscream?query=' + encodeURIComponent(query), (results) => {
        app.snippets = results;
      }, (status) => console.err(status));
      _.each(_.keys(app.files), (file) => {
        xhr_get('file/starscream?file=' + encodeURIComponent(file) + '&query=' + encodeURIComponent(query),
                (snippet) => app.$set(app.files, file, snippet),
                (status) => console.error(status));
      });
    },
    addFile: function(file) {
      xhr_get('file/starscream?file=' + encodeURIComponent(file) + '&query=' + encodeURIComponent(app.query),
              (snippet) => app.$set(app.files, file, snippet),
              (status) => console.error(status));
    }
  }
});

addEventListener('keydown', function(event) {
  if (event.code == 'Space' && event.ctrlKey) {
    document.querySelector('.search-input').focus();
  }
});
