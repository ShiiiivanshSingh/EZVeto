document.addEventListener('DOMContentLoaded', () => {

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (!target) return;
            window.scrollTo({
                top: target.getBoundingClientRect().top + window.pageYOffset,
                behavior: 'smooth'
            });
        });
    });

    window.addEventListener('scroll', () => {
        const hero = document.querySelector('.hero');
        if (hero) hero.style.backgroundPositionY = window.pageYOffset * 0.5 + 'px';
    });

    const hamburger = document.querySelector('.hamburger');
    const menu = document.querySelector('.menu');

    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        menu.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
        if (!hamburger.contains(e.target) && !menu.contains(e.target)) {
            hamburger.classList.remove('active');
            menu.classList.remove('active');
        }
    });

    document.querySelectorAll('.menu a').forEach(link => {
        link.addEventListener('click', () => {
            hamburger.classList.remove('active');
            menu.classList.remove('active');
        });
    });

    class VetoSystem {
        constructor() {
            this.maps = ['Ancient', 'Anubis', 'Dust2', 'Inferno', 'Mirage', 'Nuke', 'Train'];
            this.currentPhase = 'format-selection';
            this.format = null;
            this.coinWinner = null;
            this.firstBanTeam = null;
            this.currentTeam = null;
            this.bannedMaps = [];
            this.pickedMaps = [];
            this.mapOrder = [];
            this.sideSelections = {};
            this.vetoOrder = [];
            this.teamNames = { a: 'Team A', b: 'Team B' };

            this.init();
        }

        init() {
            this.setupEventListeners();
            this.updateProgress();
            this.restoreState();
        }

        setupEventListeners() {
            // Team name inputs
            document.querySelectorAll('.team-name-input').forEach(input => {
                input.addEventListener('change', (e) => {
                    const team = e.target.dataset.team;
                    const val = e.target.value.trim();
                    if (val) {
                        this.teamNames[team] = val;
                        // Update ban section headers live
                        const header = document.querySelector('.team-' + team + '-bans h3');
                        if (header) header.textContent = val;
                        this.saveState();
                    }
                });
            });

            document.querySelectorAll('.format-btn').forEach(btn => {
                btn.addEventListener('click', (e) => this.selectFormat(e.target.dataset.format));
            });

            document.querySelector('.flip-button').addEventListener('click', () => this.flipCoin());

            document.querySelectorAll('.toss-choice-btn').forEach(btn => {
                btn.addEventListener('click', (e) => this.chooseBanOrder(e.target.dataset.choice));
            });

            document.querySelectorAll('.map-item').forEach(map => {
                map.addEventListener('click', (e) => this.handleMapClick(e));
            });

            document.querySelectorAll('.side').forEach(side => {
                side.addEventListener('click', (e) => this.handleSideSelection(e));
            });

            document.querySelector('.reset-button').addEventListener('click', () => this.reset());
        }

        get teamA() { return this.teamNames.a || 'Team A'; }
        get teamB() { return this.teamNames.b || 'Team B'; }

        selectFormat(format) {
            this.format = format;
            document.querySelectorAll('.format-btn').forEach(b => b.classList.remove('selected'));
            document.querySelector('[data-format="' + format + '"]').classList.add('selected');
            this.switchPhase('team-assignment');
        }

        flipCoin() {
            const coin = document.querySelector('.coin');
            const flipButton = document.querySelector('.flip-button');
            const tossResult = document.querySelector('.toss-result');
            const tossChoice = document.querySelector('.toss-choice');

            // Update coin face labels to current team names
            const sideA = coin.querySelector('.side-a');
            const sideB = coin.querySelector('.side-b');
            if (sideA) sideA.textContent = this.teamA;
            if (sideB) sideB.textContent = this.teamB;

            tossResult.textContent = '';
            tossResult.classList.remove('show');
            tossChoice.classList.remove('show');
            flipButton.disabled = true;

            const rotations = (Math.floor(Math.random() * 3) + 3) * 360;
            // extraRotation 0 = lands on side-a (teamA wins), 180 = side-b (teamB wins)
            const extraRotation = Math.random() < 0.5 ? 0 : 180;
            coin.style.transform = 'rotateY(' + (rotations + extraRotation) + 'deg)';

            this.coinWinner = extraRotation === 0 ? this.teamA : this.teamB;

            setTimeout(() => {
                tossResult.textContent = this.coinWinner + ' wins the toss!';
                tossResult.classList.add('show');

                setTimeout(() => {
                    flipButton.disabled = false;
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
            this.currentTeam = this.firstBanTeam;
            this.switchPhase('ban-phase');
            this.updateTurnIndicator();
        }

        getVetoRules() {
            switch (this.format) {
                case 'bo1':
                    // Standard BO1: teams alternate banning 3 each (6 total), 1 map remains
                    return {
                        sequence: [
                            { type: 'ban', team: 1 },
                            { type: 'ban', team: 2 },
                            { type: 'ban', team: 1 },
                            { type: 'ban', team: 2 },
                            { type: 'ban', team: 1 },
                            { type: 'ban', team: 2 },
                            { type: 'remaining', team: null }
                        ]
                    };
                case 'bo3':
                    // Standard BO3: ban ban pick pick ban ban → remaining decider
                    return {
                        sequence: [
                            { type: 'ban', team: 1 },
                            { type: 'ban', team: 2 },
                            { type: 'pick', team: 1 },
                            { type: 'pick', team: 2 },
                            { type: 'ban', team: 1 },
                            { type: 'ban', team: 2 },
                            { type: 'remaining', team: null }
                        ]
                    };
                case 'bo5':
                    // Standard BO5: ban ban pick pick pick pick → remaining
                    return {
                        sequence: [
                            { type: 'ban', team: 1 },
                            { type: 'ban', team: 2 },
                            { type: 'pick', team: 1 },
                            { type: 'pick', team: 2 },
                            { type: 'pick', team: 1 },
                            { type: 'pick', team: 2 },
                            { type: 'remaining', team: null }
                        ]
                    };
            }
        }

        teamName(slot) {
            if (slot === null) return null;
            const secondTeam = this.firstBanTeam === this.teamA ? this.teamB : this.teamA;
            return slot === 1 ? this.firstBanTeam : secondTeam;
        }

        // Stable CSS class key based on slot, not raw team name
        teamClass(teamName) {
            return teamName === this.teamA ? 'team-a' : 'team-b';
        }

        getCurrentAction() {
            const rules = this.getVetoRules();
            return rules.sequence[this.vetoOrder.length] || null;
        }

        handleMapClick(e) {
            const map = e.currentTarget;
            if (map.classList.contains('banned') || map.classList.contains('picked')) return;

            const currentAction = this.getCurrentAction();
            if (!currentAction) return;

            if (currentAction.type === 'ban') {
                this.banMap(map);
            } else if (currentAction.type === 'pick') {
                this.pickMap(map, false);
            } else if (currentAction.type === 'remaining') {
                this.pickMap(map, true);
            }
        }

        banMap(map) {
            const currentAction = this.getCurrentAction();
            const currentTeamName = this.teamName(currentAction.team);

            map.classList.add('banned');
            this.bannedMaps.push(map.dataset.map);

            this.vetoOrder.push({ type: 'ban', team: currentTeamName, map: map.dataset.map });

            const banList = document.querySelector(
                '.' + this.teamClass(currentTeamName) + '-bans .ban-list'
            );
            const item = document.createElement('li');
            item.textContent = 'Banned ' + map.dataset.map;
            banList.appendChild(item);

            this.moveToNextTurn();
        }

        pickMap(map, isRemaining) {
            const currentAction = this.getCurrentAction();
            const currentTeamName = isRemaining ? null : this.teamName(currentAction.team);

            map.classList.add('picked');
            this.pickedMaps.push(map.dataset.map);

            this.vetoOrder.push({
                type: isRemaining ? 'remaining' : 'pick',
                team: currentTeamName,
                map: map.dataset.map
            });

            if (!isRemaining && currentTeamName) {
                const banList = document.querySelector(
                    '.' + this.teamClass(currentTeamName) + '-bans .ban-list'
                );
                const item = document.createElement('li');
                item.textContent = 'Picked ' + map.dataset.map;
                item.classList.add('pick');
                banList.appendChild(item);
            }

            this.mapOrder.push({
                map: map.dataset.map,
                picker: isRemaining ? 'Decider' : currentTeamName
            });

            this.moveToNextTurn();
        }

        isVetoComplete() {
            return this.vetoOrder.length >= this.getVetoRules().sequence.length;
        }

        moveToNextTurn() {
            this.saveState();

            if (this.isVetoComplete()) {
                this.switchPhase('side-selection');
                this.showMapOrder();
                return;
            }

            const nextAction = this.getCurrentAction();
            if (!nextAction) return;

            if (nextAction.team !== null) {
                this.currentTeam = this.teamName(nextAction.team);
            }

            this.updateTurnIndicator();
        }

        updateTurnIndicator() {
            const indicator = document.querySelector('.turn-indicator');
            const currentAction = this.getCurrentAction();

            if (!currentAction) {
                indicator.textContent = 'Veto Complete';
                return;
            }

            if (currentAction.type === 'remaining') {
                indicator.textContent = 'Click the last remaining map to confirm it as the decider';
            } else {
                const team = this.teamName(currentAction.team);
                const action = currentAction.type === 'ban' ? 'ban' : 'pick';
                indicator.textContent = team + "'s turn to " + action;
            }
        }

        // Side-picker is always the OPPONENT of whoever picked the map.
        // For decider maps: the coin flip LOSER picks the starting side.
        sidePickerForMap(mapEntry) {
            const loser = this.coinWinner === this.teamA ? this.teamB : this.teamA;
            if (mapEntry.picker === 'Decider') {
                return loser;
            }
            return mapEntry.picker === this.teamA ? this.teamB : this.teamA;
        }

        showMapOrder() {
            const mapOrderDiv = document.querySelector('.map-order');
            if (!this.mapOrder.length) return;

            const currentIndex = Object.keys(this.sideSelections).length;
            const currentMapEntry = this.mapOrder[currentIndex];
            if (!currentMapEntry) return;

            const sidePicker = this.sidePickerForMap(currentMapEntry);
            mapOrderDiv.innerHTML =
                '<span>' + sidePicker + '</span> selects starting side for <span>' + currentMapEntry.map + '</span>';
        }

        handleSideSelection(e) {
            if (this._sideSelecting) return;
            const side = e.currentTarget;
            const currentMapIndex = Object.keys(this.sideSelections).length;
            const currentMapEntry = this.mapOrder[currentMapIndex];

            if (!currentMapEntry) return;

            this._sideSelecting = true;
            document.querySelectorAll('.side').forEach(s => s.classList.remove('selected'));
            side.classList.add('selected');

            this.sideSelections[currentMapEntry.map] = side.classList.contains('ct') ? 'CT' : 'T';

            setTimeout(() => {
                this._sideSelecting = false;
                if (Object.keys(this.sideSelections).length >= this.mapOrder.length) {
                    this.showSummary();
                } else {
                    const nextIndex = Object.keys(this.sideSelections).length;
                    const nextMapEntry = this.mapOrder[nextIndex];
                    if (nextMapEntry) {
                        const sidePicker = this.sidePickerForMap(nextMapEntry);
                        document.querySelector('.map-order').innerHTML =
                            '<span>' + sidePicker + '</span> selects starting side for <span>' + nextMapEntry.map + '</span>';
                        document.querySelectorAll('.side').forEach(s => s.classList.remove('selected'));
                    }
                }
            }, 800);

            this.saveState();
        }

        showSummary() {
            const summary = document.querySelector('.summary-content');
            const formatNum = this.format === 'bo1' ? '1' : this.format === 'bo3' ? '3' : '5';

            const mapsHTML = this.mapOrder.map((item, index) => {
                const sidePicker = this.sidePickerForMap(item);
                const chosenSide = this.sideSelections[item.map];
                const otherSide = chosenSide === 'CT' ? 'T' : 'CT';
                const otherTeam = sidePicker === this.teamA ? this.teamB : this.teamA;
                const pickerLabel = item.picker === 'Decider' ? 'Decider Map' : item.picker + ' Pick';
                const icon = item.picker === 'Decider' ? 'fa-random' : 'fa-user-check';

                const sideA = chosenSide === 'CT'
                    ? '<span class="side-split-item"><span class="ct-label"><i class="fas fa-shield-alt"></i> CT</span><span class="team-label">' + sidePicker + '</span></span>'
                    : '<span class="side-split-item"><span class="t-label"><i class="fas fa-crosshairs"></i> T</span><span class="team-label">' + sidePicker + '</span></span>';
                const sideB = otherSide === 'CT'
                    ? '<span class="side-split-item"><span class="ct-label"><i class="fas fa-shield-alt"></i> CT</span><span class="team-label">' + otherTeam + '</span></span>'
                    : '<span class="side-split-item"><span class="t-label"><i class="fas fa-crosshairs"></i> T</span><span class="team-label">' + otherTeam + '</span></span>';

                return '<div class="map-summary-card">' +
                    '<div class="map-number">Map ' + (index + 1) + '</div>' +
                    '<div class="map-details">' +
                    '<div class="map-name">' + item.map + '</div>' +
                    '<div class="map-info">' +
                    '<span class="map-info-pill"><i class="fas ' + icon + '"></i> ' + pickerLabel + '</span>' +
                    '<span class="side-split">' + sideA + sideB + '</span>' +
                    '</div></div></div>';
            }).join('');

            summary.innerHTML =
                '<div class="format-display"><h3>Match Format: Best of ' + formatNum + '</h3></div>' +
                '<div class="maps-summary">' + mapsHTML + '</div>';

            this.switchPhase('summary');
        }

        switchPhase(phase) {
            document.querySelectorAll('.phase-container').forEach(c => c.classList.remove('active'));
            document.querySelector('.' + phase).classList.add('active');
            this.currentPhase = phase;
            this.updateProgress();
            this.saveState();
        }

        updateProgress() {
            const steps = ['format-selection', 'team-assignment', 'ban-phase', 'side-selection', 'summary'];
            const currentIndex = steps.indexOf(this.currentPhase);
            document.querySelectorAll('.progress-step').forEach((step, index) => {
                step.classList.toggle('active', index <= currentIndex);
            });
        }

        reset() {
            this.currentPhase = 'format-selection';
            this.format = null;
            this.coinWinner = null;
            this.firstBanTeam = null;
            this.currentTeam = null;
            this.bannedMaps = [];
            this.pickedMaps = [];
            this.mapOrder = [];
            this.sideSelections = {};
            this.vetoOrder = [];
            this.teamNames = { a: 'Team A', b: 'Team B' };

            document.querySelectorAll('.map-item').forEach(c => c.classList.remove('banned', 'picked'));
            document.querySelectorAll('.side').forEach(s => s.classList.remove('selected'));
            document.querySelectorAll('.ban-list').forEach(l => l.innerHTML = '');
            document.querySelectorAll('.format-btn').forEach(b => b.classList.remove('selected'));

            // Reset team name inputs and headers
            document.querySelectorAll('.team-name-input').forEach(input => {
                const team = input.dataset.team;
                input.value = team === 'a' ? 'Team A' : 'Team B';
            });
            const hA = document.querySelector('.team-a-bans h3');
            const hB = document.querySelector('.team-b-bans h3');
            if (hA) hA.textContent = 'Team A';
            if (hB) hB.textContent = 'Team B';

            const coin = document.querySelector('.coin');
            if (coin) coin.style.transform = 'rotateY(0deg)';

            const tossResult = document.querySelector('.toss-result');
            if (tossResult) { tossResult.textContent = ''; tossResult.classList.remove('show'); }

            const tossChoice = document.querySelector('.toss-choice');
            if (tossChoice) tossChoice.classList.remove('show');

            const indicator = document.querySelector('.turn-indicator');
            if (indicator) indicator.textContent = '';

            const mapOrder = document.querySelector('.map-order');
            if (mapOrder) mapOrder.innerHTML = '';

            const summaryEl = document.querySelector('.summary-content');
            if (summaryEl) summaryEl.innerHTML = '';

            sessionStorage.removeItem('vetoState');
            this.switchPhase('format-selection');
        }

        saveState() {
            const state = {
                currentPhase: this.currentPhase,
                format: this.format,
                coinWinner: this.coinWinner,
                firstBanTeam: this.firstBanTeam,
                currentTeam: this.currentTeam,
                bannedMaps: this.bannedMaps,
                pickedMaps: this.pickedMaps,
                mapOrder: this.mapOrder,
                sideSelections: this.sideSelections,
                vetoOrder: this.vetoOrder,
                teamNames: this.teamNames
            };
            sessionStorage.setItem('vetoState', JSON.stringify(state));
        }

        restoreState() {
            const savedState = sessionStorage.getItem('vetoState');
            if (!savedState) return;

            const state = JSON.parse(savedState);
            Object.assign(this, state);

            if (this.currentPhase === 'format-selection') return;

            this.switchPhase(this.currentPhase);

            if (this.format) {
                const btn = document.querySelector('[data-format="' + this.format + '"]');
                if (btn) btn.classList.add('selected');
            }

            // Restore team name inputs and ban headers
            document.querySelectorAll('.team-name-input').forEach(input => {
                const team = input.dataset.team;
                input.value = this.teamNames[team] || (team === 'a' ? 'Team A' : 'Team B');
            });
            const hA = document.querySelector('.team-a-bans h3');
            const hB = document.querySelector('.team-b-bans h3');
            if (hA) hA.textContent = this.teamA;
            if (hB) hB.textContent = this.teamB;

            this.bannedMaps.forEach(mapName => {
                const el = document.querySelector('[data-map="' + mapName + '"]');
                if (el) el.classList.add('banned');
            });

            this.pickedMaps.forEach(mapName => {
                const el = document.querySelector('[data-map="' + mapName + '"]');
                if (el) el.classList.add('picked');
            });

            this.vetoOrder.forEach(veto => {
                if (!veto.team) return;
                const banList = document.querySelector(
                    '.' + this.teamClass(veto.team) + '-bans .ban-list'
                );
                if (banList) {
                    const item = document.createElement('li');
                    item.textContent = (veto.type === 'ban' ? 'Banned' : 'Picked') + ' ' + veto.map;
                    if (veto.type === 'pick') item.classList.add('pick');
                    banList.appendChild(item);
                }
            });

            if (this.currentPhase === 'ban-phase') {
                this.updateTurnIndicator();
            }

            if (this.currentPhase === 'side-selection') {
                this.showMapOrder();
            }

            if (this.currentPhase === 'summary') {
                this.showSummary();
            }

            if (this.currentPhase === 'team-assignment' && this.coinWinner) {
                const tossResult = document.querySelector('.toss-result');
                tossResult.textContent = this.coinWinner + ' wins the toss!';
                tossResult.classList.add('show');
                document.querySelector('.toss-choice-prompt').textContent =
                    this.coinWinner + ', do you want to ban first or second?';
                document.querySelector('.toss-choice').classList.add('show');
            }

            const vetoSection = document.getElementById('veto');
            if (vetoSection && document.readyState === 'complete') {
                setTimeout(() => vetoSection.scrollIntoView({ behavior: 'smooth' }), 100);
            }
        }
    }

    new VetoSystem();

    // Single load handler — scroll to top only when no active veto in progress
    window.addEventListener('load', () => {
        const savedState = sessionStorage.getItem('vetoState');
        if (savedState) {
            try {
                const state = JSON.parse(savedState);
                if (state.currentPhase && state.currentPhase !== 'format-selection') return;
            } catch (e) {
                sessionStorage.removeItem('vetoState');
            }
        }
        window.scrollTo({ top: 0, behavior: 'instant' });
    });
});