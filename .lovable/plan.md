# Plan — Mode Drone : assignations temporelles & trajectoires

## Objectif
Permettre d'assigner chaque drone à un ancrage d'une forme à un instant T de la timeline, visualiser ces assignations dans la vue logique, et animer physiquement les drones le long de trajectoires pointillées sans collision.

---

## 1. Modèle de données (`src/types/drone.ts` + `editor.ts`)

Ajouter :
```ts
// Une assignation = "à temps t, drone D doit être à l'ancrage A de la forme F"
interface DroneAssignment {
  id: string;
  droneId: string;       // EditorObject3D.id du drone
  shapeId: string;       // EditorObject3D.id de la forme porteuse d'ancrages
  anchorId: string;      // Anchor.id dans shape.anchors
  time: number;          // ms sur la timeline
}
```

Stockage : `EditorState.droneAssignments: DroneAssignment[]`.

Chaque forme reçoit aussi `shapeTime?: number` (ms) : moment où la forme doit être "dessinée" (tous ses ancrages occupés).

---

## 2. Vue Logique (mode drone) — `LogicalView.tsx`

Refonte en mode drone :
- **Colonne gauche** : liste des drones (un nœud par drone, 1 sortie).
- **Colonne droite** : liste des formes 3D ayant des ancrages. Chaque forme = un nœud avec **N entrées** (une par ancrage) et **N sorties** symétriques. Le nœud affiche son `shapeTime` éditable.
- **Câblage** : tirer du drone vers une entrée d'ancrage crée une `DroneAssignment` au temps = `shapeTime` de la forme cible.
- Plusieurs câbles partant du même drone vers différentes formes = trajectoire ordonnée par `shapeTime`.

Rendu simple : nœuds positionnables, câbles SVG (réutilise le style existant de LogicalView).

---

## 3. Propriétés (`PropertiesPanelLogical.tsx`)

Quand le nœud sélectionné est :
- **Drone** : nom, modèle, vitesse max (lecture seule depuis `droneProduct`).
- **Forme** : champ "Instant de la forme (s)" — édite `shapeTime`.
- **Assignation (clic sur câble)** : éditeur de temps de l'assignation (par défaut = shapeTime).

---

## 4. Timeline — `Timeline.tsx`

Pour chaque drone, afficher une piste avec des marqueurs aux temps d'assignation. Cliquer = sélectionne l'assignation. Glisser = change `time`.

---

## 5. Animation physique — nouveau `src/hooks/useDroneAnimation.ts`

À chaque frame (selon `currentTime`) :
1. Pour chaque drone, trier ses assignations par `time`.
2. Trouver l'intervalle `[t_prev, t_next]` encadrant `currentTime`.
3. Position cible = interpolation linéaire (eased) entre l'ancrage précédent (worldspace) et le suivant.
4. **Évitement de collisions** : algorithme simple — pour chaque paire de drones, si distance < `safeRadius` (≈ 2× diamètre), appliquer une force de répulsion perpendiculaire au mouvement (steering). Itérer 2-3 fois par frame.
5. Écrire la position calculée dans un store éphémère `droneRuntimePositions` (Map<id, vec3>) consommé par `Drone3D`.

Coordonnées d'ancrage → monde : appliquer la transformation de la forme (position + rotation + scale) à `anchor.position`.

---

## 6. Trajectoires pointillées — `Canvas3D.tsx`

Nouveau composant `DroneTrajectory3D` : pour chaque drone, tracer une `Line` (drei) pointillée passant par tous ses ancrages assignés dans l'ordre temporel. Matériau : `LineDashedMaterial` couleur = couleur LED du drone.

Visible uniquement quand mode drone actif. Le segment actuellement parcouru est mis en surbrillance (couleur pleine).

---

## 7. Drone3D — mise à jour

Lit sa position runtime depuis le store si le mode physique est actif, sinon utilise `properties.x/y/z` (mode édition).

---

## Détails techniques

### Fichiers à créer
- `src/hooks/useDroneAnimation.ts` (boucle d'animation + collision avoidance)
- `src/components/editor/DroneTrajectory3D.tsx` (rendu pointillés)
- `src/lib/droneCollision.ts` (steering / répulsion)

### Fichiers à modifier
- `src/types/drone.ts` (DroneAssignment)
- `src/types/editor.ts` (EditorState.droneAssignments, EditorObject3D.shapeTime)
- `src/hooks/useEditorState.ts` (CRUD assignments, shapeTime)
- `src/components/editor/LogicalView.tsx` (rendu drones/formes/câbles en mode drone)
- `src/components/editor/PropertiesPanelLogical.tsx` (édition shapeTime, assignment time)
- `src/components/editor/Timeline.tsx` (pistes d'assignations drone)
- `src/components/editor/Canvas3D.tsx` (intègre DroneTrajectory3D + runtime positions)
- `src/components/editor/Drone3D.tsx` (lecture runtime)
- `src/lib/fileOperations.ts` (sauvegarde .flpt avec assignments)

### Algorithme évitement de collisions (résumé)
```
for each drone d:
  target = interpolate(prev_anchor, next_anchor, t)
  for each other drone o:
    delta = d.pos - o.pos
    if |delta| < safeRadius:
      target += normalize(delta) * (safeRadius - |delta|) * 0.5
  d.pos = lerp(d.pos, target, dampingFactor)
```

Pas de pathfinding global pour v1 — uniquement répulsion locale, suffisant tant que la densité reste raisonnable.

---

## Points à confirmer
1. **Création d'assignations** : uniquement via la vue logique (drag-drop drone→ancrage) ? Ou aussi via clic direct sur un ancrage en 3D quand un drone est sélectionné ?
2. **shapeTime par défaut** : 0 ms, ou réparti automatiquement (forme 1 à 1s, forme 2 à 2s…) ?
3. **Collision** : rayon de sécurité fixe (ex. 1m) ou basé sur le diamètre du drone × facteur ?
4. **Si plus de drones que d'ancrages** dans une forme : les drones excédentaires restent à leur position précédente, OK ?
