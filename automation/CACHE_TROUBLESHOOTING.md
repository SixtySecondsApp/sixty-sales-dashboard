# Résolution des Problèmes de Cache Cursor

## 🔍 Problème : Contexte Pollué Entre les Tickets

### Symptômes
- Le bot traite le Ticket B, mais implémente les changements du Ticket A
- Les Pull Requests contiennent des modifications non liées au ticket actuel
- La description du PR est correcte, mais les fichiers modifiés ne correspondent pas
- CodeRabbit summary montre des changements complètement différents de la description
- Cursor semble "se souvenir" des conversations précédentes ou travailler sur un autre sujet

### Cause Racine
**Cursor CLI conserve un cache de conversation/session** entre les appels. Même si nous passons un nouveau prompt, Cursor maintient le contexte de la session précédente et continue à travailler sur l'ancien ticket.

De plus, **Cursor a tendance à "analyser" et "décider lui-même"** ce qui doit être fait plutôt que de suivre strictement les instructions du prompt. Il peut ignorer le prompt et travailler sur ce qu'il pense être plus pertinent d'après son contexte précédent.

## ✅ Solutions Implémentées

### 1. **Fichier de Spécification de Tâche** (🎯 SOLUTION PRINCIPALE)

Au lieu d'envoyer un long prompt que Cursor peut ignorer, le bot crée maintenant un **fichier de spécification markdown** (`.CURRENT_TASK_SPEC.md`) qui contient :

- Le Task ID exact
- Le titre de la tâche
- La description complète
- Des instructions strictes "DO NOT work on anything else"
- Des avertissements répétés

**Avantages** :
- ✅ Cursor doit **lire le fichier** et ne peut pas l'ignorer
- ✅ Le contenu est **persisté** et ne dépend pas du contexte de conversation
- ✅ Instructions très **explicites** et **isolées** du reste
- ✅ Fichier **nettoyé automatiquement** après implémentation

**Prompt utilisé** :
```
Read the file .CURRENT_TASK_SPEC.md and implement EXACTLY what is described in it.
CRITICAL: Follow ONLY the specifications in .CURRENT_TASK_SPEC.md. Do NOT work on anything else.
```

**Code** : Voir `ticket-bot.sh`, ligne ~190-240

### 2. **Nettoyage Explicite du Cache**

Avant chaque implémentation de ticket, le bot nettoie maintenant :

```bash
# Répertoires de cache Cursor
~/.cursor/cache
~/.cursor/.cursor-agent
~/.cursor/sessions
~/.local/share/cursor-agent/sessions

# Fichiers temporaires
/tmp/cursor-*
/tmp/tmp.*
```

**Code** : Voir `ticket-bot.sh`, ligne ~161-180

### 3. **Prompt avec Contexte Unique**

Chaque ticket reçoit maintenant :
- Un **Session ID unique** : `session-1701501234-ef0e036e`
- Un **timestamp** : Pour forcer la détection comme nouvelle tâche
- Des **avertissements visuels** : 🚨 NEW TASK - DISCARD ALL PREVIOUS CONTEXT
- Des **instructions répétées** : Le Task ID est mentionné plusieurs fois

**Code** : Voir `ticket-bot.sh`, ligne ~190-240

### 4. **Variables d'Environnement**

Le bot définit des variables d'environnement pour "signaler" à Cursor de démarrer une nouvelle session :

```bash
CURSOR_FORCE_NEW_SESSION=1
CURSOR_CLEAR_HISTORY=1
CURSOR_SESSION_ID="session-timestamp-taskid"
```

**Code** : Voir `ticket-bot.sh`, ligne ~280-285

### 5. **Délai Entre les Tickets**

Un délai de **30 secondes** est ajouté entre le traitement de chaque ticket pour :
- Permettre à Cursor de finaliser/nettoyer ses sessions
- Éviter de surcharger le système
- Laisser le temps au cache de se vider

**Code** : Voir `ticket-bot.sh`, ligne ~460-468

### 6. **Vérification Post-Implémentation**

Après chaque implémentation, le bot vérifie :
- Que des changements ont été faits (`git diff`)
- Quels fichiers ont été modifiés (log des 5 premiers)
- Si aucun changement → warning (probablement mauvais ticket traité)

**Code** : Voir `ticket-bot.sh`, ligne ~300-315

## 🧪 Test du Nettoyage de Cache

Un script de test est fourni pour vérifier et nettoyer manuellement le cache :

```bash
cd automation
chmod +x test-cache-clear.sh
./test-cache-clear.sh
```

Ce script :
1. ✅ Liste tous les répertoires de cache Cursor
2. 📊 Affiche leur taille
3. 🗑️ Propose de les nettoyer (avec confirmation)

## 📋 Instructions de Mise à Jour sur Ubuntu

```bash
# 1. Mettre à jour le template
cd ~/projects/ai-dev-hub/automation
git pull

# 2. Déployer vers l'application
./update-bot.sh ~/projects/ai-dev-hub/application

# 3. Nettoyer les anciennes branches (recommandé)
cd ~/projects/ai-dev-hub/application
git checkout main
git branch | grep "auto/ticket-" | xargs -r git branch -D

# 4. Tester le nettoyage de cache
cd automation
chmod +x test-cache-clear.sh
./test-cache-clear.sh

# 5. Tester avec un ticket
./ticket-bot.sh --test --ticket-id <TICKET_ID> --dry-run
```

## 🔍 Vérification

Pour vérifier que le bot traite bien le bon ticket, regardez les logs :

```bash
tail -f automation/lib/logs/ticket-bot-$(date +%Y-%m-%d).log
```

**Éléments à vérifier** :
1. ✅ `Clearing Cursor cache and session data`
2. ✅ `Session ID: session-XXXXX-YYYYYYY`
3. ✅ `Task ID: <le bon ID>`
4. ✅ `Modified files: <fichiers pertinents au ticket>`
5. ⚠️ Si `No changes detected` → problème probable

## 🚨 Si le Problème Persiste

### Option 1 : Redémarrer Cursor Complètement

```bash
# Fermer tous les processus Cursor
pkill -9 cursor
pkill -9 cursor-agent

# Nettoyer le cache
rm -rf ~/.cursor/cache
rm -rf ~/.cursor/.cursor-agent
rm -rf ~/.cursor/sessions
rm -rf ~/.local/share/cursor-agent/sessions

# Relancer le bot
cd ~/projects/ai-dev-hub/application/automation
./ticket-bot.sh
```

### Option 2 : Augmenter le Délai

Modifier `ticket-bot.sh` ligne ~413 :

```bash
local delay_seconds=60  # Au lieu de 30
```

### Option 3 : Mode Manuel

Traiter les tickets un par un :

```bash
./ticket-bot.sh --test --ticket-id <TICKET_1>
# Attendre la fin complète
./ticket-bot.sh --test --ticket-id <TICKET_2>
```

## 📝 Notes Techniques

### Pourquoi le Cache n'est pas Suffisant ?

Même avec `--force` et `--approve-mcps`, Cursor CLI maintient un **contexte de conversation** similaire à ChatGPT. C'est une fonctionnalité pour améliorer la cohérence, mais dans notre cas, c'est un problème car nous voulons des contextes **complètement isolés**.

### Alternatives Explorées

1. ❌ `--new-session` : Option non disponible dans cette version
2. ❌ `--clear-history` : Option non disponible
3. ✅ Nettoyage manuel du cache : **Fonctionne**
4. ✅ Prompt ultra-explicite : **Aide**
5. ✅ Délai entre tickets : **Aide**

## 🎯 Résumé

**La combinaison de toutes ces solutions devrait résoudre le problème de cache.** Si le problème persiste, il faudra envisager :

1. Contacter l'équipe Cursor pour demander une option `--new-session`
2. Utiliser une approche complètement différente (API directe au lieu de CLI)
3. Redémarrer le processus Cursor entre chaque ticket

