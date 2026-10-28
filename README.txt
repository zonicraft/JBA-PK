JBA POKÉMON
===========

A Pokémon fan game based on Pokémon Essentials for RPG Maker, where the
Pokémon have been swapped for anime characters (and friends). It runs in the
browser: a JavaScript engine plays the maps, events and data that were
converted from the RPG Maker project.

This is an unofficial, non-commercial fan project. Pokémon is owned by
Nintendo, Game Freak and The Pokémon Company. Built on Pokémon Essentials and
the work of its authors and community.


PLAYING
-------
Open index.html in your browser and press Enter to start.

  Arrow keys / WASD   move
  Z / Enter / Space   confirm
  X                   cancel (hold X or Shift to run once you have the sneakers)

The game saves through its own in-game menu.


WHAT'S IN THE GAME
------------------
The story currently runs from Pallet Town to Vermilion City:

  Pallet Town, Route 1, Viridian City, Route 2, Viridian Forest, Pewter City
  (gym 1), Route 3, Mt. Moon, Route 4, Cerulean City (gym 2), Routes 24 and 25,
  Route 5, Saffron City (gym 3), Route 6, Vermilion City (gym 4), Route 11 and
  the Burrow Tunnel.

The build stops after Vermilion; the harbor and the later gates are not built
yet.

  - Choose a starter and battle your rival in the lab
  - Turn-based trainer and wild battles with moves, abilities and animations
  - Pokédex, berries, shops, Poké Centers, TMs
  - Four gyms with badges; roads and shop stock open up as you earn them
  - Exp Share is always on, so the whole party gains experience
  - A CHEATS entry under BAG in the pause menu (level up, Rare Candies,
    money, full heal) if you want to skip grinding


PROJECT LAYOUT
--------------
  index.html         the game page
  js/                game code
                       engine.js    maps, events, characters, command runner
                       world.js     overworld, encounters, items
                       battle.js    battle system
                       menus*.js    pause menu, bag, party, shops, options
                       pokedex.js, berries.js, anim.js, ui.js, story.js, main.js
                       data.js, pokejson.js   species and move data
  data/              map files (mapNNN.js), tilesets.js, mapnames.js, pbs.js
                     (Essentials PBS data), anims.js
  assets/            animations, audio, autotiles, battlebacks, battlers,
                     characters, cries, faces, fonts, icons, pictures, se,
                     tilesets, trainers, ui
  pokemon.json       species data (names, types, stats, moves, evolutions)
  editor.html        the map and script editor (see below)
  _editor_backups/   backups made by the editor (ignored by git)
  todo.txt           open tasks and known issues

Species data is read from data/pokemon.js when the game is opened from disk,
and from pokemon.json directly when it is served over http(s).


MAP AND SCRIPT EDITOR
---------------------
editor.html edits the game's maps and events straight from this folder.

  1. Open editor.html, click "Open game folder…", choose this folder and allow
     editing.
  2. Pick a map to see its real tiles and character sprites. Events are drawn
     with their sprites and numbers; the selected event's movement paths are
     drawn on the map (cutscene moves as R1, R2…, repeating patrols dashed).
  3. Click an event to edit its pages, conditions, sprite, movement and
     commands. Dialogue is edited in a text box and other commands read like
     sentences ("Turn switch 12 to ON", "Teleport player to map 3 at 3, 8").
     The { } button on a line shows its raw data.
  4. Click an empty tile and use "Add event here" to create an event.
  5. Ctrl+S saves. The first save of each map each day copies the original into
     _editor_backups/.
  6. "Test here" opens the game directly on that map and tile. The Variables
     (e.g. 201:5) and Switches (e.g. 12,14) boxes set values first, so late
     scenes can be tested without playing from the start.
  7. The search box on the left searches dialogue and script lines in every map.

The editor does not paint tiles; map layouts are not edited.

Test links work without the editor too:
  index.html?map=ID&x=X&y=Y&dir=2&vars=201:5,3:2&sw=12,14
starts in map ID at tile (X, Y), with variables set (id:value) and switches on.


NOTES
-----
See todo.txt for the current list of fixes and ideas.
