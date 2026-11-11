HOW TO TRANSLATE JBA POKEMON
============================

Every text of the game lives in a language file in this folder:

  lang/en.js   all the English text (reference, not loaded by the game)
  lang/pt.js   Portuguese template: every entry is empty, fill them in

Open pt.js in any text editor (Notepad, VS Code ...). It has two blocks:

  text: { "English sentence": "Your translation", ... }
        dialogue, menus, battle messages, place names, trainer names, trainer lines.
        The English text on the left is how the game finds the entry: do NOT change it.
        Write the translation between the quotes on the right.

  data: { "MV.ABSORB.name": "Your translation",  // English text ... }
        names and descriptions of Pokemon, moves, items, abilities, types and trainer classes.
        The English text is in the comment (after //) on the same line. Do not change the key on the left.

Rules
  * An empty "" means "show the English text", so you can translate a little at a time.
  * Keep the placeholders {0} {1} {2}: the game puts names or numbers there ("{0} used {1}!").
    You may reorder them to fit your language, but keep every one.
  * Keep the codes inside dialogue as they are:  \b  \r  \c[2]  \PN (player name)  \v[3]  \n  <ac>  \ff[name]
    and "\n" line breaks. A quote inside a text is written \"
  * Each entry ends with a comma. If the game shows nothing in a language, a quote or comma is probably missing:
    open the browser console (F12) to see the error and line number.
  * Texts that are drawn inside pictures (the battle command buttons, the logo ...) cannot be translated this way.

Add a new language
  1. Copy en.js to fr.js (for example). Inside it change  window.LANG.en  to  window.LANG.fr  and  name: 'English'  to  name: 'Français'.
     (If you start from the empty pt.js layout instead, run tools/extract_lang.py fr - see below.)
  2. Add 'fr' to the list in lang/index.js.
  3. Open the game, Options > Language, choose it. You can also open index.html?lang=fr.

When the game text changes (new dialogue, new Pokemon ...) run   python tools/extract_lang.py   in the game folder:
it rewrites en.js and adds the new entries (empty) to every language file, keeping the translations you already made.
(needs Python 3 and Node.js. Or ask Claude to run it.)

Testing: open the game with  index.html?i18n=debug  and, in the browser console (F12), type  I18N.missing()
to list the texts that were shown on screen without a translation.

The Pokedex (POKEDEX.html)
  It follows the language chosen in the game (Options > Language) and reads the same lang/<code>.js file for Pokemon, move,
  ability, type and place names. The texts that only the Pokedex has (filters, headings, notes) are in lang/dex_<code>.js:
  copy lang/dex_pt.js to dex_fr.js, change LANG_DEX.pt to LANG_DEX.fr and translate the right-hand side.
