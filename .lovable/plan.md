# Plan — Vidéoprojecteur de mapping (mode combiné)

## Objectif
Ajouter un nouveau type de fixture "vidéoprojecteur de mapping" utilisable en mode combiné :
- Un bloc 3D avec un faisceau lumineux tronconique
- Une vidéo associée, éditée dans la timeline comme une piste audio
- La vidéo est projetée sur les surfaces frappées par le faisceau (projected texture)
- Configuration du keystone (4 coins) pour adapter la déformation à la surface
- Propriété "distance max" pour limiter la portée du faisceau

---

## 1. Nouveau type d'objet — `videoprojector`

`src/types/editor.ts`
- Ajouter `'videoprojector'` à `Shape3DType`.
- Étendre `Object3DProperties` (optionnels, spécifiques mapping) :
  - `throwDistance?: number` (distance max de projection, m)
  - `throwRatio?: number` (ratio largeur/distance, contrôle l'ouverture)
  - `keystone?: { tl:[x,y], tr:[x,y], br:[x,y], bl:[x,y] }` (offsets normalisés -1..1 par coin)
  - `videoTrackId?: string` (lien vers la piste vidéo)

## 2. Piste vidéo dans la timeline

`src/types/editor.ts` + `useEditorState.ts`
- Nouveau type `VideoTrack { id, name, file, url, duration, projectorId }`.
- `EditorState.videoTracks: VideoTrack[]`.
- Actions CRUD : `addVideoTrack`, `removeVideoTrack`, `assignVideoToProjector`.

`Timeline.tsx`
- Nouvelle section "Vidéos" sous "Audio", même UI (waveform remplacée par une bande de vignettes ou barre unie), lecture synchronisée sur `currentTime`.
- Bouton "+ Ajouter vidéo" (input file `video/*`).

## 3. Bibliothèque / ajout du projecteur

Bouton "Ajouter vidéoprojecteur" dans la barre d'outils du mode combiné (à côté des autres ajouts de fixtures). Crée un `EditorObject3D` de type `videoprojector`.

## 4. Rendu 3D — `VideoProjector3D.tsx`

Nouveau composant :
- Corps : `<Box>` métallique noir avec lentille frontale.
- Faisceau volumétrique : cône transparent orienté selon rotation, longueur = `throwDistance`, base = `throwDistance * throwRatio`.
- Texture projetée : élément `<video>` HTML masqué → `VideoTexture` three.js.
- Projection utilise un `THREE.ProjectorMaterial` custom (shader) OU une approche plus simple : `SpotLight` avec `map` (texture projetée) — supporté par three.js via `SpotLight.map` + `LightShadow`.
- Keystone : appliqué en pré-déformant les UV via un shader (matrice d'homographie calculée depuis les 4 coins).

Intégration dans `Canvas3D.tsx` : rendre chaque projecteur, connecter sa `<video>` au `currentTime` global et au play/pause.

## 5. Keystone editor

`ProjectConfigDialog.tsx` (ou nouveau `KeystoneDialog.tsx` ouvert depuis les propriétés du projecteur) :
- Aperçu carré 300×200 avec la vidéo (ou une mire).
- 4 poignées draggables aux coins, contraintes dans [-0.5, +0.5].
- Bouton "Réinitialiser".
- Sauvegarde dans `properties.keystone`.

## 6. Propriétés du projecteur

`PropertiesPanel3D.tsx` — quand `type === 'videoprojector'` :
- Sliders position / rotation (existants).
- **Distance max** (slider `throwDistance` 1–100 m).
- **Throw ratio** (slider 0.3–3).
- Sélecteur "Piste vidéo" (liste des `videoTracks`, ou bouton "Uploader vidéo").
- Bouton "Régler keystone…" ouvre le dialog.

## 7. Sauvegarde `.flpt`

`fileOperations.ts`
- Sérialiser `videoTracks` en base64 (comme audio).
- Inclure `keystone`, `throwDistance`, etc.

---

## Fichiers à créer
- `src/components/editor/VideoProjector3D.tsx`
- `src/components/editor/KeystoneDialog.tsx`
- `src/lib/videoTexture.ts` (helpers video→texture + shader keystone)

## Fichiers à modifier
- `src/types/editor.ts`
- `src/hooks/useEditorState.ts`
- `src/components/editor/Canvas3D.tsx`
- `src/components/editor/Timeline.tsx`
- `src/components/editor/PropertiesPanel3D.tsx`
- `src/components/editor/AnimationEditor.tsx` (bouton ajout)
- `src/lib/fileOperations.ts`

---

## Détails techniques

### Projection vidéo sur surfaces
Approche retenue : `THREE.SpotLight` avec propriété `map` (texture vidéo). Simple, gère nativement l'atténuation par distance (`distance = throwDistance`) et respecte les ombres. Limitation : pas de keystone natif — on l'implémente en pré-déformant la texture avant assignation (canvas intermédiaire dessinant la vidéo avec transformation d'homographie via `ctx.setTransform` par tuiles, ou via un `ShaderMaterial` custom si la qualité est insuffisante).

### Keystone (homographie)
4 points source (coins carré unité) → 4 points destination (coins déformés). Calcul de la matrice 3×3 classique, appliquée dans le shader UV = H * uv.

### Synchro vidéo ↔ timeline
`videoElement.currentTime = editorState.currentTime / 1000` à chaque frame ; `play()` / `pause()` selon `isPlaying`. `VideoTexture.needsUpdate = true` chaque frame.

### Distance max
Utilisée directement comme `SpotLight.distance` et longueur du cône volumétrique. Au-delà, la vidéo n'apparaît plus (atténuation naturelle).

---

## Point à confirmer
- **Format vidéo** accepté : MP4/WebM uniquement (compatibilité navigateur), OK ?
- **Une piste vidéo = un projecteur** (lien 1↔1), ou plusieurs projecteurs peuvent partager la même vidéo ?
