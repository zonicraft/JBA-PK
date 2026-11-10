// Language files to load. Add a line here for every new language file in this folder (e.g. 'fr' -> lang/fr.js).
// English is built into the game; lang/en.js is the reference list of every English text (it is not loaded).
(function () {
  var langs = ['pt'];
  for (var i = 0; i < langs.length; i++) document.write('<script src="lang/' + langs[i] + '.js?v=' + Date.now() + '"><\/script>');
})();
