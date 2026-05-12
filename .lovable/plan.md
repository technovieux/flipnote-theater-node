# Plan d'implémentation

Deux gros chantiers : (A) améliorations sur l'existant, (B) nouveau **mode Drone**.

---

## A. Améliorations

### A1. Case "Afficher la luminosité dynamique"
- Ajouter `dynamicLighting: boolean` (défaut `true`) dans `ProjectConfig` (`src/types/editor.ts`).
- Ajouter une checkbox dans `ProjectConfigDialog.tsx` (onglet Projet du mode Combiné).
- Dans `Canvas3D.tsx` : si `dynamicLighting === false`, ne pas calculer `sunLight`, garder le rendu sombre par défaut (lights actuelles + `studio` env).
- Persistance via le state existant + `.flpt`.

### A2. Lumières réelles spots & feux + projection colorée
- Spots (`SpotlightLyre3D`) : ajouter un vrai `<spotLight>` Three.js attaché à la tête, color = couleur calculée depuis les canaux DMX (R/G/B ou couleur fixe), `castShadow`, `angle`, `penumbra`. Activer `receiveShadow` sur le sol et objets cibles.
- Feux d'artifices : pendant l'explosion, ajouter `<pointLight>` éphémère à la position du burst, couleur = couleur du feu, intensité décroissante.
- Activer `shadowMap` sur le `<Canvas>` et `receiveShadow` sur les meshes statiques pour que les zones éclairées prennent réellement la teinte des sources.

### A3. Barre de recherche dans LogicalView
Remplacer les boutons « Bibliothèque consoles/projecteurs/feux » par un seul `<Input>` + `Popover`/liste filtrée :
- Tape pour filtrer parmi consoles + spots + feux (selon catégorie sélectionnée).
- Click sur un résultat = ajout direct (équivalent au flux actuel des dialogs).
- Garde les 3 boutons de catégorie (consoles / spots / feux) au-dessus.

---

## B. Mode Drone

### B1. Activation
- Le bouton existe déjà sur le Welcome screen → câbler `mode: 'drone'`.
- `EditorMode` += `'drone'`, `modeDrone: boolean` dans `EditorState`.
- Copie de la logique du mode Combiné **sans** spots ni feux d'artifices. Garde : 3D, logical view, timeline, projectConfig, soleil dynamique.

### B2. Bibliothèque de drones
- Nouveau fichier `public/data/drones.json` avec quelques modèles (DJI-like : nom, masse, LED color capability, autonomie, vitesse max).
- Nouveau type `DroneProduct` dans `src/types/drone.ts`.
- Nouveau `DroneLibraryDialog.tsx` (calqué sur `SpotlightLibraryDialog`).
- Représentation 3D simple (sphère + croix LED) ou OBJ.

### B3. Points d'ancrage sur formes 3D
Nouveau composant `AnchorEditor` activé via bouton « Définir ancrages » sur un objet 3D sélectionné en mode Drone :
- Modes de sélection : **Sommets / Arêtes / Faces** (toggle).
- Click sur un élément géométrique → input « diviser en N points » → génère N positions équidistantes le long de l'arête, ou un grille NxN sur la face, ou ajoute le vertex.
- Chaque ancrage stocké comme `Anchor { id, parentObjectId, position: vec3, sourceType, sourceIndex }`.
- Affichés en 3D comme petites croix (`+` style sprite ou `LineSegments`).
- Dans `ObjectsList3D`, sous-arborescence : chaque objet 3D avec ancrages a des enfants `Zone N` (groupes d'ancrages d'une même opération de division).

### B4. Vue Logique en mode Drone
- Catégories de la barre de recherche : **Drones** (= consoles 1 DMX) | **Zones** (= sous-objets/animations).
- Chaque drone ajouté = nœud type "console 1 entrée DMX".
- Chaque zone ajoutée = nœud avec **N ports** (N = nombre d'ancrages).
- Câbler drone → port d'une zone définit l'attribution drone/ancrage.
- L'ordre des zones (ordre d'apparition dans le canvas logique ou index) définit l'ordre temporel de visite.

### B5. Animation physique des drones
Dans `useEditorState` / nouveau hook `useDroneAnimation` :
- Pour chaque keyframe d'un objet/zone dans la timeline → temps cible où **tous les drones de cette zone** doivent être à leurs ancrages.
- Propriété "Durée de stationnement (s)" remplace l'adresse DMX dans `PropertiesPanelLogical` quand l'objet logique est une zone.
- Interpolation linéaire entre positions précédente et suivante de chaque drone, en respectant son port assigné.
- Rendu en mode physique : drones se déplacent vers leur ancrage, restent N secondes, puis vers la zone suivante.

### B6. Propriétés en mode logique drone
- Nœud drone : nom, ID DMX (1 canal).
- Nœud zone : nom, **durée stationnement (s)** au lieu d'adresse DMX.

---

## Détails techniques

### Fichiers à créer
- `public/data/drones.json`
- `src/types/drone.ts`
- `src/components/editor/DroneLibraryDialog.tsx`
- `src/components/editor/AnchorEditor.tsx`
- `src/components/editor/Drone3D.tsx`
- `src/hooks/useDroneAnimation.ts`

### Fichiers à modifier
- `src/types/editor.ts` (ProjectConfig.dynamicLighting, EditorMode 'drone', modeDrone, Anchor type, sub-objects in EditorObject3D)
- `src/components/editor/ProjectConfigDialog.tsx` (checkbox)
- `src/components/editor/Canvas3D.tsx` (gate sunLight, shadowMap)
- `src/components/editor/SpotlightLyre3D.tsx` (vrai spotLight coloré)
- `src/components/editor/FireworkSimulation.tsx` (pointLight burst)
- `src/components/editor/LogicalView.tsx` (search bar, mode drone categories)
- `src/components/editor/PropertiesPanelLogical.tsx` (durée stationnement)
- `src/components/editor/ObjectsList3D.tsx` (sous-objets ancrages)
- `src/components/editor/AnimationEditor.tsx` (router mode drone)
- `src/components/editor/WelcomeDialog.tsx` (câbler bouton drone)
- `src/hooks/useEditorState.ts` (nouveaux states + actions)
- `src/lib/fileOperations.ts` (sauvegarde .flpt v1.5 avec drones/anchors)

### Ordre d'implémentation
1. A1 (rapide, isolé)
2. A3 (UI seule)
3. A2 (rendu 3D)
4. B1 + B2 (squelette mode drone + lib)
5. B3 (ancrages, le plus complexe)
6. B4 (logique)
7. B5 + B6 (animation + propriétés)

---

## Points à confirmer
- **Représentation visuelle des drones** : sphère LED simple générée, ou un OBJ (genre quadcopter) ? → je pars sur sphère + croix LED procédurale, plus léger.
- **Division des faces** : grille uniforme NxN, ou N points en spirale/aléatoire ? → grille uniforme.
- **Trajectoires** : ligne droite entre ancrages successifs (pas d'évitement de collisions) → OK pour v1.
- **Une seule "passe" de drones par zone** : nombre de drones doit ≤ nombre d'ancrages. Si moins de drones que d'ancrages, certains ports restent libres ; si plus, l'excès est ignoré.

Je peux ajuster ces choix avant de coder si tu préfères autre chose.
