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
  data: function() {
    return {
      code: _.map(this.snippet.lines, (line) => line.full)
        .join('\n')
    };
  },
  mounted: function() {
    let line_number = this.snippet.line_number;
    let cm = CodeMirror.fromTextArea(this.$el, {
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
  updated: function() {
    console.log('updated');
  },
  template: '<textarea>{{ code }}</textarea>'
});

let app = new Vue({
  el: '#app',
  data: {
    query: '',
    grouped_snippets: []
  },
  methods: {
    search: function(event) {
      app.query = event.target.value;
      if (app.query.length < 3) {
        return;
      }
      xhr_get('search/2?query=' + encodeURIComponent(app.query), (results) => {
        app.grouped_snippets = _.chain(results)
          .groupBy((snippet) => snippet.file.path)
          .mapObject((snippets) => {
            return _.sortBy(snippets, (s) => s.line_number);
          })
          .values()
          .sortBy((group) => group[0].file.path)
          .value();
      }, (status) => console.err(status));
    },
  }
});
