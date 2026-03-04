document.addEventListener('DOMContentLoaded', () => {

    // Smooth scroll
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) window.scrollTo({ top: target.getBoundingClientRect().top + window.pageYOffset, behavior: 'smooth' });
        });
    });

    // Parallax
    window.addEventListener('scroll', () => {
        const hero = document.querySelector('.hero');
        if (hero) hero.style.backgroundPositionY = window.pageYOffset * 0.5 + 'px';
    });

    // Hamburger
    const hamburger = document.querySelector('.hamburger');
    const menu = document.querySelector('.menu');
    hamburger.addEventListener('click', () => { hamburger.classList.toggle('active'); menu.classList.toggle('active'); });
    document.addEventListener('click', e => {
        if (!hamburger.contains(e.target) && !menu.contains(e.target)) { hamburger.classList.remove('active'); menu.classList.remove('active'); }
    });
    document.querySelectorAll('.menu a').forEach(link => {
        link.addEventListener('click', () => { hamburger.classList.remove('active'); menu.classList.remove('active'); });
    });

    // ─────────────────────────────────────────
    class VetoSystem {
        constructor() {
            this.maps        = ['Ancient','Anubis','Dust2','Inferno','Mirage','Nuke','Overpass'];
            this.currentPhase = 'format-selection';
            this.format      = null;
            this.coinWinner  = null;
            this.firstBanTeam = null;
            this.currentTeam = null;
            this.bannedMaps  = [];
            this.pickedMaps  = [];
            this.mapOrder    = [];          // [{map, picker}]
            this.sideSelections = {};       // {mapName: 'CT'|'T'}
            this.vetoOrder   = [];
            this.teamNames   = { a: 'Team A', b: 'Team B' };
            this.vetoStartTime = null;
            this.logEntries  = [];          // unified log
            this._sideSelecting = false;
            this._elapsedInterval = null;

            this.init();
        }

        get teamA() { return this.teamNames.a || 'Team A'; }
        get teamB() { return this.teamNames.b || 'Team B'; }

        init() {
            this.setupEventListeners();
            this.updateProgress();
            this.restoreState();
        }

        setupEventListeners() {
            document.querySelectorAll('.team-name-input').forEach(input => {
                input.addEventListener('change', e => {
                    const team = e.target.dataset.team;
                    const val  = e.target.value.trim();
                    if (!val) return;
                    this.teamNames[team] = val;
                    const h = document.querySelector('.team-' + team + '-bans h3');
                    if (h) h.textContent = val;
                    this.saveState();
                });
            });

            document.querySelectorAll('.format-btn').forEach(btn =>
                btn.addEventListener('click', e => this.selectFormat(e.target.dataset.format))
            );

            document.querySelector('.flip-button').addEventListener('click', () => this.flipCoin());

            document.querySelectorAll('.toss-choice-btn').forEach(btn =>
                btn.addEventListener('click', e => this.chooseBanOrder(e.target.dataset.choice))
            );

            document.querySelectorAll('.map-item').forEach(map =>
                map.addEventListener('click', e => this.handleMapClick(e))
            );

            document.getElementById('ssCT').addEventListener('click',     () => this.handleSideSelection('CT'));
            document.getElementById('ssTSide').addEventListener('click',  () => this.handleSideSelection('T'));

            document.querySelector('.reset-button').addEventListener('click', () => this.reset());
            document.getElementById('shareBtn').addEventListener('click',    () => this.copyTextSummary());
            document.getElementById('shareUrlBtn').addEventListener('click', () => this.copyShareUrl());
        }

        // ── FORMAT ──────────────────────────────
        selectFormat(format) {
            this.format = format;
            document.querySelectorAll('.format-btn').forEach(b => b.classList.remove('selected'));
            document.querySelector('[data-format="' + format + '"]').classList.add('selected');
            this.switchPhase('team-assignment');
        }

        // ── COIN FLIP ────────────────────────────
        flipCoin() {
            const coin      = document.querySelector('.coin');
            const flipBtn   = document.querySelector('.flip-button');
            const tossRes   = document.querySelector('.toss-result');
            const tossChoice = document.querySelector('.toss-choice');

            coin.querySelector('.side-a').textContent = this.teamA;
            coin.querySelector('.side-b').textContent = this.teamB;

            tossRes.textContent = '';
            tossRes.classList.remove('show');
            tossChoice.classList.remove('show');
            flipBtn.disabled = true;

            const rotations    = (Math.floor(Math.random() * 3) + 3) * 360;
            const extraRotation = Math.random() < 0.5 ? 0 : 180;
            coin.style.transform = 'rotateY(' + (rotations + extraRotation) + 'deg)';
            this.coinWinner = extraRotation === 0 ? this.teamA : this.teamB;

            setTimeout(() => {
                tossRes.textContent = this.coinWinner + ' wins the toss!';
                tossRes.classList.add('show');
                setTimeout(() => {
                    flipBtn.disabled = false;
                    document.querySelector('.toss-choice-prompt').textContent =
                        this.coinWinner + ', do you want to ban first or second?';
                    tossChoice.classList.add('show');
                    this.saveState();
                }, 1000);
            }, 1500);
        }

        chooseBanOrder(choice) {
            const loser = this.coinWinner === this.teamA ? this.teamB : this.teamA;
            this.firstBanTeam = choice === 'first' ? this.coinWinner : loser;
            this.currentTeam  = this.firstBanTeam;
            this.vetoStartTime = Date.now();
            this.logEntries    = [];
            this.startElapsedClock();
            this.switchPhase('ban-phase');
            this.updateTurnIndicator();
        }

        // ── VETO RULES ───────────────────────────
        getVetoRules() {
            switch (this.format) {
                case 'bo1': return { sequence: [
                    {type:'ban',team:1},{type:'ban',team:2},{type:'ban',team:1},
                    {type:'ban',team:2},{type:'ban',team:1},{type:'ban',team:2},
                    {type:'remaining',team:null}
                ]};
                case 'bo3': return { sequence: [
                    {type:'ban',team:1},{type:'ban',team:2},
                    {type:'pick',team:1},{type:'pick',team:2},
                    {type:'ban',team:1},{type:'ban',team:2},
                    {type:'remaining',team:null}
                ]};
                case 'bo5': return { sequence: [
                    {type:'ban',team:1},{type:'ban',team:2},
                    {type:'pick',team:1},{type:'pick',team:2},
                    {type:'pick',team:1},{type:'pick',team:2},
                    {type:'remaining',team:null}
                ]};
            }
        }

        teamName(slot) {
            if (slot === null) return null;
            const second = this.firstBanTeam === this.teamA ? this.teamB : this.teamA;
            return slot === 1 ? this.firstBanTeam : second;
        }

        teamClass(name) { return name === this.teamA ? 'team-a' : 'team-b'; }

        getCurrentAction() {
            const rules = this.getVetoRules();
            return rules.sequence[this.vetoOrder.length] || null;
        }

        // ── MAP CLICK ────────────────────────────
        handleMapClick(e) {
            const map = e.currentTarget;
            if (map.classList.contains('banned') || map.classList.contains('picked')) return;
            const action = this.getCurrentAction();
            if (!action) return;
            if (action.type === 'ban')       this.banMap(map);
            else if (action.type === 'pick') this.pickMap(map, false);
            else if (action.type === 'remaining') this.pickMap(map, true);
        }

        banMap(map) {
            const action = this.getCurrentAction();
            const team   = this.teamName(action.team);
            map.classList.add('banned');
            this.bannedMaps.push(map.dataset.map);
            this.vetoOrder.push({ type:'ban', team, map: map.dataset.map });
            this.addLog('ban', team, map.dataset.map);

            const list = document.querySelector('.' + this.teamClass(team) + '-bans .ban-list');
            if (list) {
                const li = document.createElement('li');
                li.textContent = 'Banned ' + map.dataset.map;
                list.appendChild(li);
            }
            this.moveToNextTurn();
        }

        pickMap(map, isRemaining) {
            const action = this.getCurrentAction();
            const team   = isRemaining ? null : this.teamName(action.team);
            map.classList.add('picked');
            this.pickedMaps.push(map.dataset.map);
            this.vetoOrder.push({ type: isRemaining ? 'remaining' : 'pick', team, map: map.dataset.map });
            this.addLog(isRemaining ? 'decider' : 'pick', team, map.dataset.map);

            if (!isRemaining && team) {
                const list = document.querySelector('.' + this.teamClass(team) + '-bans .ban-list');
                if (list) {
                    const li = document.createElement('li');
                    li.textContent = 'Picked ' + map.dataset.map;
                    li.classList.add('pick');
                    list.appendChild(li);
                }
            }
            this.mapOrder.push({ map: map.dataset.map, picker: isRemaining ? 'Decider' : team });
            this.moveToNextTurn();
        }

        isVetoComplete() { return this.vetoOrder.length >= this.getVetoRules().sequence.length; }

        moveToNextTurn() {
            this.saveState();
            if (this.isVetoComplete()) {
                this.switchPhase('side-selection');
                this.renderSideSelection();
                return;
            }
            const next = this.getCurrentAction();
            if (next && next.team !== null) this.currentTeam = this.teamName(next.team);
            this.updateTurnIndicator();
        }

        updateTurnIndicator() {
            const el = document.querySelector('.turn-indicator');
            const action = this.getCurrentAction();
            if (!action) { el.textContent = 'Veto Complete'; return; }
            if (action.type === 'remaining') {
                el.textContent = 'Click the last remaining map — it becomes the decider';
            } else {
                const team = this.teamName(action.team);
                el.textContent = team + "'s turn to " + (action.type === 'ban' ? 'BAN' : 'PICK');
            }
        }

        // ── SIDE SELECTION ───────────────────────
        sidePickerForMap(mapEntry) {
            const loser = this.coinWinner === this.teamA ? this.teamB : this.teamA;
            if (mapEntry.picker === 'Decider') return loser;
            return mapEntry.picker === this.teamA ? this.teamB : this.teamA;
        }

        renderSideSelection() {
            const currentIdx = Object.keys(this.sideSelections).length;
            const currentMap = this.mapOrder[currentIdx];

            // Sync elapsed timer label to SS panel
            const ssEl = document.getElementById('ssElapsed');
            const mainEl = document.getElementById('vetoElapsed');
            if (ssEl && mainEl) ssEl.textContent = mainEl.textContent;

            // Render completed maps
            const doneEl = document.getElementById('ssDone');
            if (doneEl) {
                doneEl.innerHTML = Object.entries(this.sideSelections).map(([mapName, side]) => {
                    const entry = this.mapOrder.find(m => m.map === mapName);
                    const picker = entry ? this.sidePickerForMap(entry) : '';
                    const other  = side === 'CT' ? 'T' : 'CT';
                    const otherTeam = picker === this.teamA ? this.teamB : this.teamA;
                    return '<div class="ss-done-row">'
                        + '<span class="ss-done-map">' + mapName + '</span>'
                        + '<span class="ss-done-tag ' + side.toLowerCase() + '">' + side + ' ' + picker + '</span>'
                        + '<span class="ss-done-tag ' + other.toLowerCase() + '">' + other + ' ' + otherTeam + '</span>'
                        + '</div>';
                }).join('');
            }

            // Sync log to SS panel
            this.syncLog('ssLogBody');

            if (!currentMap) return;

            const picker = this.sidePickerForMap(currentMap);
            const promptMap  = document.getElementById('ssPromptMap');
            const promptText = document.getElementById('ssPromptText');
            if (promptMap)  promptMap.textContent  = currentMap.map;
            if (promptText) promptText.textContent = picker + ' — choose your starting side';

            // Reset button states
            document.getElementById('ssCT').classList.remove('selected');
            document.getElementById('ssTSide').classList.remove('selected');
        }

        handleSideSelection(chosenSide) {
            if (this._sideSelecting) return;
            const currentIdx = Object.keys(this.sideSelections).length;
            const currentMap = this.mapOrder[currentIdx];
            if (!currentMap) return;

            this._sideSelecting = true;
            const btnId = chosenSide === 'CT' ? 'ssCT' : 'ssTSide';
            document.getElementById('ssCT').classList.remove('selected');
            document.getElementById('ssTSide').classList.remove('selected');
            document.getElementById(btnId).classList.add('selected');

            this.sideSelections[currentMap.map] = chosenSide;

            const picker    = this.sidePickerForMap(currentMap);
            const otherSide = chosenSide === 'CT' ? 'T' : 'CT';
            const otherTeam = picker === this.teamA ? this.teamB : this.teamA;
            this.addLog('side', picker, currentMap.map, chosenSide, otherTeam, otherSide);
            this.saveState();

            setTimeout(() => {
                this._sideSelecting = false;
                if (Object.keys(this.sideSelections).length >= this.mapOrder.length) {
                    this.showSummary();
                } else {
                    this.renderSideSelection();
                }
            }, 500);
        }

        // ── LIVE LOG ─────────────────────────────
        addLog(type, team, mapName, chosenSide, otherTeam, otherSide) {
            if (!this.vetoStartTime) this.vetoStartTime = Date.now();
            const ms   = Date.now() - this.vetoStartTime;
            const mins = Math.floor(ms / 60000);
            const secs = Math.floor((ms % 60000) / 1000);
            const time = mins + ':' + String(secs).padStart(2, '0');
            const entry = { type, team, mapName, time, chosenSide, otherTeam, otherSide };
            this.logEntries.push(entry);
            // Push to whichever log panels exist right now
            ['liveLogBody', 'ssLogBody', 'summaryLogBody'].forEach(id => {
                this.appendLogRow(document.getElementById(id), entry);
            });
        }

        appendLogRow(container, entry) {
            if (!container) return;
            const empty = container.querySelector('.live-log-empty');
            if (empty) empty.remove();

            const row = document.createElement('div');
            row.className = 'log-row log-' + entry.type;

            let text = '';
            if (entry.type === 'ban') {
                text = '<span class="log-team">' + entry.team + '</span> <span class="log-verb ban">BANNED</span> <span class="log-map">' + entry.mapName + '</span>';
            } else if (entry.type === 'pick') {
                text = '<span class="log-team">' + entry.team + '</span> <span class="log-verb pick">PICKED</span> <span class="log-map">' + entry.mapName + '</span>';
            } else if (entry.type === 'decider') {
                text = '<span class="log-map">' + entry.mapName + '</span> <span class="log-verb decider">DECIDER</span>';
            } else if (entry.type === 'side') {
                const ctColor = entry.chosenSide === 'CT' ? 'ct' : 't';
                const tColor  = entry.otherSide  === 'CT' ? 'ct' : 't';
                text = '<span class="log-map">' + entry.mapName + '</span>'
                     + ' — <span class="log-side ' + ctColor + '">' + entry.chosenSide + '</span> <span class="log-team">' + entry.team + '</span>'
                     + ' · <span class="log-side ' + tColor + '">' + entry.otherSide + '</span> <span class="log-team">' + entry.otherTeam + '</span>';
            }

            row.innerHTML = '<span class="log-time">' + entry.time + '</span>' + text;
            container.appendChild(row);
            container.scrollTop = container.scrollHeight;
        }

        syncLog(containerId) {
            const el = document.getElementById(containerId);
            if (!el) return;
            el.innerHTML = '';
            this.logEntries.forEach(e => this.appendLogRow(el, e));
        }

        startElapsedClock() {
            if (this._elapsedInterval) clearInterval(this._elapsedInterval);
            this._elapsedInterval = setInterval(() => {
                if (!this.vetoStartTime) return;
                const ms   = Date.now() - this.vetoStartTime;
                const mins = Math.floor(ms / 60000);
                const secs = Math.floor((ms % 60000) / 1000);
                const str  = mins + ':' + String(secs).padStart(2, '0');
                ['vetoElapsed','ssElapsed','summaryElapsed'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.textContent = str;
                });
            }, 1000);
        }

        // ── SUMMARY ──────────────────────────────
        showSummary() {
            const formatNum = this.format === 'bo1' ? '1' : this.format === 'bo3' ? '3' : '5';
            const summary = document.querySelector('.summary-content');

            const mapsHTML = this.mapOrder.map((item, i) => {
                const picker    = this.sidePickerForMap(item);
                const chosen    = this.sideSelections[item.map] || '?';
                const other     = chosen === 'CT' ? 'T' : 'CT';
                const otherTeam = picker === this.teamA ? this.teamB : this.teamA;
                const isDecider = item.picker === 'Decider';
                const typeLabel = isDecider ? 'Decider' : item.picker + ' pick';

                return '<div class="summary-map-card">'
                    + '<div class="smc-left">'
                    +   '<div class="smc-num">Map ' + (i+1) + '</div>'
                    +   '<div class="smc-name">' + item.map + '</div>'
                    +   '<div class="smc-type' + (isDecider ? ' decider' : '') + '">' + typeLabel + '</div>'
                    + '</div>'
                    + '<div class="smc-sides">'
                    +   '<div class="smc-side ct">'
                    +     '<div class="smc-side-tag ct"><i class="fas fa-shield-alt"></i> CT</div>'
                    +     '<div class="smc-side-team">' + (chosen === 'CT' ? picker : otherTeam) + '</div>'
                    +   '</div>'
                    +   '<div class="smc-vs">vs</div>'
                    +   '<div class="smc-side t">'
                    +     '<div class="smc-side-tag t"><i class="fas fa-crosshairs"></i> T</div>'
                    +     '<div class="smc-side-team">' + (chosen === 'T' ? picker : otherTeam) + '</div>'
                    +   '</div>'
                    + '</div>'
                    + '</div>';
            }).join('');

            summary.innerHTML = '<div class="format-display"><h3>Best of ' + formatNum + '</h3></div>'
                + '<div class="maps-summary">' + mapsHTML + '</div>';

            this.switchPhase('summary');
            // Populate summary log
            this.syncLog('summaryLogBody');
            const sEl = document.getElementById('summaryElapsed');
            const mEl = document.getElementById('vetoElapsed');
            if (sEl && mEl) sEl.textContent = mEl.textContent;
        }

        // ── SHARE ────────────────────────────────
        copyTextSummary() {
            const formatNum = this.format === 'bo1' ? '1' : this.format === 'bo3' ? '3' : '5';
            const lines = ['EZVeto — Best of ' + formatNum, ''];
            this.mapOrder.forEach((item, i) => {
                const picker = this.sidePickerForMap(item);
                const chosen = this.sideSelections[item.map] || '?';
                const other  = chosen === 'CT' ? 'T' : 'CT';
                const otherTeam = picker === this.teamA ? this.teamB : this.teamA;
                lines.push('Map ' + (i+1) + ': ' + item.map + (item.picker === 'Decider' ? ' [Decider]' : ' [' + item.picker + ' pick]'));
                lines.push('  CT: ' + (chosen === 'CT' ? picker : otherTeam) + '  |  T: ' + (chosen === 'T' ? picker : otherTeam));
                lines.push('');
            });
            if (this.logEntries.length) {
                lines.push('── Veto Log ──');
                this.logEntries.forEach(e => {
                    if (e.type === 'side') {
                        lines.push('[' + e.time + '] ' + e.mapName + ': CT ' + (e.chosenSide==='CT'?e.team:e.otherTeam) + ' | T ' + (e.chosenSide==='T'?e.team:e.otherTeam));
                    } else {
                        const verb = e.type === 'ban' ? 'BANNED' : e.type === 'pick' ? 'PICKED' : 'DECIDER';
                        lines.push('[' + e.time + '] ' + (e.team || '') + ' ' + verb + ' ' + e.mapName);
                    }
                });
            }
            navigator.clipboard.writeText(lines.join('\n')).then(() => {
                const btn = document.getElementById('shareBtn');
                btn.classList.add('copied');
                btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                setTimeout(() => { btn.classList.remove('copied'); btn.innerHTML = '<i class="fas fa-copy"></i> Copy Result'; }, 2000);
            });
        }

        copyShareUrl() {
            const state = { format: this.format, teamNames: this.teamNames, coinWinner: this.coinWinner,
                firstBanTeam: this.firstBanTeam, mapOrder: this.mapOrder,
                sideSelections: this.sideSelections, vetoOrder: this.vetoOrder, logEntries: this.logEntries };
            const encoded = btoa(encodeURIComponent(JSON.stringify(state)));
            const url = window.location.origin + window.location.pathname + '?veto=' + encoded;
            navigator.clipboard.writeText(url).then(() => {
                const btn = document.getElementById('shareUrlBtn');
                btn.classList.add('copied');
                btn.innerHTML = '<i class="fas fa-check"></i> Link Copied!';
                setTimeout(() => { btn.classList.remove('copied'); btn.innerHTML = '<i class="fas fa-link"></i> Share Link'; }, 2000);
            });
        }

        // ── PHASE / PROGRESS ─────────────────────
        switchPhase(phase) {
            document.querySelectorAll('.phase-container').forEach(c => c.classList.remove('active'));
            document.querySelector('.' + phase).classList.add('active');
            this.currentPhase = phase;
            this.updateProgress();
            this.saveState();
        }

        updateProgress() {
            const steps = ['format-selection','team-assignment','ban-phase','side-selection','summary'];
            const idx = steps.indexOf(this.currentPhase);
            document.querySelectorAll('.progress-step').forEach((s, i) => s.classList.toggle('active', i <= idx));
        }

        // ── RESET ────────────────────────────────
        reset() {
            if (this._elapsedInterval) clearInterval(this._elapsedInterval);
            this.currentPhase  = 'format-selection';
            this.format        = null;
            this.coinWinner    = null;
            this.firstBanTeam  = null;
            this.currentTeam   = null;
            this.bannedMaps    = [];
            this.pickedMaps    = [];
            this.mapOrder      = [];
            this.sideSelections = {};
            this.vetoOrder     = [];
            this.teamNames     = { a: 'Team A', b: 'Team B' };
            this.vetoStartTime = null;
            this.logEntries    = [];
            this._sideSelecting = false;

            document.querySelectorAll('.map-item').forEach(c => c.classList.remove('banned','picked'));
            document.querySelectorAll('.ban-list').forEach(l => l.innerHTML = '');
            document.querySelectorAll('.format-btn').forEach(b => b.classList.remove('selected'));
            document.querySelectorAll('.team-name-input').forEach(inp => {
                inp.value = inp.dataset.team === 'a' ? 'Team A' : 'Team B';
            });
            const hA = document.querySelector('.team-a-bans h3');
            const hB = document.querySelector('.team-b-bans h3');
            if (hA) hA.textContent = 'Team A';
            if (hB) hB.textContent = 'Team B';

            const coin = document.querySelector('.coin');
            if (coin) coin.style.transform = 'rotateY(0deg)';
            const tossRes = document.querySelector('.toss-result');
            if (tossRes) { tossRes.textContent = ''; tossRes.classList.remove('show'); }
            const tossChoice = document.querySelector('.toss-choice');
            if (tossChoice) tossChoice.classList.remove('show');
            const indicator = document.querySelector('.turn-indicator');
            if (indicator) indicator.textContent = '';
            const summaryEl = document.querySelector('.summary-content');
            if (summaryEl) summaryEl.innerHTML = '';

            const liveLog = document.getElementById('liveLogBody');
            if (liveLog) liveLog.innerHTML = '<p class="live-log-empty">Actions will appear here…</p>';
            const ssLog = document.getElementById('ssLogBody');
            if (ssLog) ssLog.innerHTML = '';
            const sumLog = document.getElementById('summaryLogBody');
            if (sumLog) sumLog.innerHTML = '';
            const ssDone = document.getElementById('ssDone');
            if (ssDone) ssDone.innerHTML = '';
            const elapsed = document.getElementById('vetoElapsed');
            if (elapsed) elapsed.textContent = '0:00';

            sessionStorage.removeItem('vetoState');
            this.switchPhase('format-selection');
        }

        // ── SAVE / RESTORE ───────────────────────
        saveState() {
            sessionStorage.setItem('vetoState', JSON.stringify({
                currentPhase: this.currentPhase, format: this.format,
                coinWinner: this.coinWinner, firstBanTeam: this.firstBanTeam,
                currentTeam: this.currentTeam, bannedMaps: this.bannedMaps,
                pickedMaps: this.pickedMaps, mapOrder: this.mapOrder,
                sideSelections: this.sideSelections, vetoOrder: this.vetoOrder,
                teamNames: this.teamNames, vetoStartTime: this.vetoStartTime,
                logEntries: this.logEntries
            }));
        }

        restoreState() {
            const saved = sessionStorage.getItem('vetoState');
            if (!saved) return;
            const s = JSON.parse(saved);
            Object.assign(this, s);
            if (this.currentPhase === 'format-selection') return;

            this.switchPhase(this.currentPhase);

            if (this.format) {
                const btn = document.querySelector('[data-format="' + this.format + '"]');
                if (btn) btn.classList.add('selected');
            }

            document.querySelectorAll('.team-name-input').forEach(inp => {
                inp.value = this.teamNames[inp.dataset.team] || (inp.dataset.team === 'a' ? 'Team A' : 'Team B');
            });
            const hA = document.querySelector('.team-a-bans h3');
            const hB = document.querySelector('.team-b-bans h3');
            if (hA) hA.textContent = this.teamA;
            if (hB) hB.textContent = this.teamB;

            this.bannedMaps.forEach(m => {
                const el = document.querySelector('[data-map="' + m + '"]');
                if (el) el.classList.add('banned');
            });
            this.pickedMaps.forEach(m => {
                const el = document.querySelector('[data-map="' + m + '"]');
                if (el) el.classList.add('picked');
            });
            this.vetoOrder.forEach(v => {
                if (!v.team) return;
                const list = document.querySelector('.' + this.teamClass(v.team) + '-bans .ban-list');
                if (list) {
                    const li = document.createElement('li');
                    li.textContent = (v.type === 'ban' ? 'Banned ' : 'Picked ') + v.map;
                    if (v.type === 'pick') li.classList.add('pick');
                    list.appendChild(li);
                }
            });

            // Restore log
            const liveLog = document.getElementById('liveLogBody');
            if (liveLog && this.logEntries.length) {
                liveLog.innerHTML = '';
                this.logEntries.forEach(e => this.appendLogRow(liveLog, e));
            }

            if (this.currentPhase === 'ban-phase') {
                this.updateTurnIndicator();
                this.startElapsedClock();
            }
            if (this.currentPhase === 'side-selection') {
                this.startElapsedClock();
                this.syncLog('ssLogBody');
                this.renderSideSelection();
            }
            if (this.currentPhase === 'summary') {
                this.showSummary();
                this.syncLog('summaryLogBody');
            }
            if (this.currentPhase === 'team-assignment' && this.coinWinner) {
                document.querySelector('.toss-result').textContent = this.coinWinner + ' wins the toss!';
                document.querySelector('.toss-result').classList.add('show');
                document.querySelector('.toss-choice-prompt').textContent =
                    this.coinWinner + ', do you want to ban first or second?';
                document.querySelector('.toss-choice').classList.add('show');
            }

            const vetoSection = document.getElementById('veto');
            if (vetoSection) setTimeout(() => vetoSection.scrollIntoView({ behavior: 'smooth' }), 100);
        }
    }

    new VetoSystem();

    window.addEventListener('load', () => {
        const saved = sessionStorage.getItem('vetoState');
        if (saved) {
            try {
                const s = JSON.parse(saved);
                if (s.currentPhase && s.currentPhase !== 'format-selection') return;
            } catch(e) { sessionStorage.removeItem('vetoState'); }
        }
        window.scrollTo({ top: 0, behavior: 'instant' });
    });
});
