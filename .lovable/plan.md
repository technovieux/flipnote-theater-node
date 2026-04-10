

# Plan : Mode Spotlight avec sortie DMX

## Résumé

Ajouter un 4ème mode "Spotlight" au menu d'accueil, fonctionnant comme le mode 2D mais pour contrôler des projecteurs scéniques. Chaque spot ajouté depuis une bibliothèque JSON possède des canaux DMX (0-255) éditables dans le panneau de propriétés. Une option "Sortie DMX" dans la barre de menu permet de sélectionner un port COM via Web Serial API et d'activer le contrôle temps réel.

## Changements prévus

### 1. Types et données

**`src/types/editor.ts`** :
- Ajouter `'spotlight'` à `EditorMode`
- Ajouter `modeSpotlight: boolean` à `EditorState`
- Créer `SpotlightFixture` (interface pour la définition d'un spot : nom, fabricant, canaux avec nom/type)
- Créer `SpotlightObject` qui étend `EditorObject` avec `fixture: SpotlightFixture`, `dmxAddress: number`, `channelValues: number[]`

**`src/types/spotlight.ts`** (nouveau) :
- `SpotlightChannel { name: string; defaultValue: number; type: 'dimmer' | 'color' | 'position' | 'gobo' | 'other' }`
- `SpotlightFixture { name: string; manufacturer: string; channels: SpotlightChannel[] }`

**`public/data/spotlight_fixtures.json`** (nouveau) :
- Base de données JSON avec ~15 fixtures (PAR LED, lyres, scanners, etc.)
- Chaque entrée : nom, fabricant, liste de canaux avec nom et type

### 2. Bibliothèque de spots

**`src/components/editor/SpotlightLibraryDialog.tsx`** (nouveau) :
- Dialog similaire à `FireworkLibraryDialog`
- Charge `spotlight_fixtures.json`, recherche, sélection
- Au clic, ajoute un objet spotlight au projet

### 3. Panneau de propriétés Spotlight

**`src/components/editor/PropertiesPanelSpotlight.tsx`** (nouveau) :
- Champ texte pour l'adresse DMX (1-512)
- Un slider (0-255) par canal du fixture sélectionné, avec le nom du canal
- Animable via keyframes (les valeurs de canaux sont interpolées)

### 4. État de l'éditeur

**`src/hooks/useEditorState.ts`** :
- Ajouter `setModeSpotlight()`, `addSpotlightObject()`, `updateSpotlightChannels()`
- Les objets spotlight utilisent le même système de keyframes que le 2D
- Les valeurs de canaux sont stockées dans les propriétés de l'objet

### 5. Menu d'accueil

**`src/components/editor/WelcomeDialog.tsx`** :
- Ajouter un 4ème bouton "💡 Spotlight" avec icône `Lightbulb`
- Disposition en 2x2 ou en ligne de 4

### 6. Sortie DMX (Web Serial API)

**`src/lib/dmxOutput.ts`** (nouveau) :
- Classe `DMXOutput` qui gère la connexion Web Serial API
- `connect(port)` : ouvre le port série (250kbaud, 8N2 pour DMX512)
- `send(channels: number[])` : envoie une trame DMX (break + données 512 canaux)
- `disconnect()` : ferme le port

**`src/components/editor/MenuBar.tsx`** :
- Ajouter un menu "Sortie DMX" visible uniquement en mode Spotlight
- Bouton "Sortie :" avec sélection de port COM (via `navigator.serial.requestPort()`)
- Checkbox "DMX temps-réel" qui, quand activé, envoie les valeurs DMX courantes à chaque frame

### 7. Intégration AnimationEditor

**`src/components/editor/AnimationEditor.tsx`** :
- Gérer le mode spotlight dans `handleSelectMode`
- Brancher `SpotlightLibraryDialog` et `PropertiesPanelSpotlight`
- En mode DMX temps-réel + lecture : envoyer les valeurs interpolées des canaux via `DMXOutput` à chaque tick

### 8. Canvas Spotlight

Le mode spotlight réutilise le `Canvas` 2D existant. Les spots sont rendus comme des cercles colorés représentant le faisceau lumineux, avec une opacité proportionnelle au canal dimmer.

## Détails techniques

- **Web Serial API** : compatible Chrome/Edge uniquement. Un message d'avertissement s'affichera si `navigator.serial` n'est pas disponible.
- **Protocole DMX512** : break de 88µs, MAB de 8µs, puis 513 octets (start code + 512 canaux) à 250kbaud.
- **Keyframes** : les valeurs de canaux DMX (0-255) sont interpolées linéairement comme les autres propriétés.

## Fichiers créés/modifiés

| Fichier | Action |
|---------|--------|
| `src/types/spotlight.ts` | Créer |
| `public/data/spotlight_fixtures.json` | Créer |
| `src/lib/dmxOutput.ts` | Créer |
| `src/components/editor/SpotlightLibraryDialog.tsx` | Créer |
| `src/components/editor/PropertiesPanelSpotlight.tsx` | Créer |
| `src/types/editor.ts` | Modifier |
| `src/hooks/useEditorState.ts` | Modifier |
| `src/components/editor/WelcomeDialog.tsx` | Modifier |
| `src/components/editor/MenuBar.tsx` | Modifier |
| `src/components/editor/AnimationEditor.tsx` | Modifier |

