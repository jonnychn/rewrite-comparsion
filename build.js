/* Inlines src/styles.css, src/diff.js and src/app.js into a single
   self-contained index.html. Run: node build.js                     */
var fs = require('fs');
var path = require('path');

var read = function (f) { return fs.readFileSync(path.join(__dirname, 'src', f), 'utf8'); };

var html = read('index.template.html')
  .replace('<!-- BUILD:STYLES -->', '<style>\n' + read('styles.css') + '\n</style>')
  .replace('<!-- BUILD:SCRIPTS -->',
    '<script>\n' + read('diff.js') + '\n</script>\n<script>\n' + read('app.js') + '\n</script>');

// A closing tag inside inline script text would end the block early.
if (/<\/script/i.test(read('diff.js') + read('app.js'))) {
  throw new Error('Source contains a literal </script> — escape it before inlining.');
}

fs.writeFileSync(path.join(__dirname, 'index.html'), html);
console.log('index.html written — ' + Math.round(html.length / 1024) + ' KB, no external files.');
