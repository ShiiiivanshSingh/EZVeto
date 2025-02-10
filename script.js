document.addEventListener('DOMContentLoaded', () => {
    const mapCards = document.querySelectorAll('.map-card');
    const bannedMapsContainers = document.querySelectorAll('.banned-maps');
    let currentTeam = 1;

    // Smooth scroll for navigation
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            
            // Get the distance from the top of the page to the target element
            const targetPosition = target.getBoundingClientRect().top + window.pageYOffset;
            
            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth'
            });
        });
    });

    // Drag and drop functionality
    mapCards.forEach(card => {
        card.addEventListener('dragstart', dragStart);
        card.addEventListener('dragend', dragEnd);
    });

    bannedMapsContainers.forEach(container => {
        container.addEventListener('dragover', dragOver);
        container.addEventListener('drop', drop);
    });

    function dragStart(e) {
        e.target.classList.add('dragging');
        e.dataTransfer.setData('text/plain', e.target.dataset.map);
    }

    function dragEnd(e) {
        e.target.classList.remove('dragging');
    }

    function dragOver(e) {
        e.preventDefault();
        e.target.classList.add('drag-over');
    }

    function drop(e) {
        e.preventDefault();
        e.target.classList.remove('drag-over');
        
        const mapName = e.dataTransfer.getData('text/plain');
        const mapCard = document.querySelector(`[data-map="${mapName}"]`);
        
        if (e.target.children.length < 3) { // Limit to 3 bans per team
            const clone = mapCard.cloneNode(true);
            clone.classList.add('banned');
            e.target.appendChild(clone);
            mapCard.style.opacity = '0.5';
            mapCard.setAttribute('draggable', 'false');
            
            currentTeam = currentTeam === 1 ? 2 : 1;
            updateTurnIndicator();
        }
    }
    function updateTurnIndicator() {
        const teams = document.querySelectorAll('.team-container h3');
        teams.forEach((team, index) => {
            team.style.color = index + 1 === currentTeam ? '#00ff88' : '#ffffff';
        });
    }

    // Parallax effect for hero section
    window.addEventListener('scroll', () => {
        const hero = document.querySelector('.hero');
        const scrolled = window.pageYOffset;
        hero.style.backgroundPositionY = scrolled * 0.5 + 'px';
    });

    // Add this at the beginning of your DOMContentLoaded event listener
    const hamburger = document.querySelector('.hamburger');
    const menu = document.querySelector('.menu');

    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        menu.classList.toggle('active');
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!hamburger.contains(e.target) && !menu.contains(e.target)) {
            hamburger.classList.remove('active');
            menu.classList.remove('active');
        }
    });

    // Close menu when clicking a link
    document.querySelectorAll('.menu a').forEach(link => {
        link.addEventListener('click', () => {
            hamburger.classList.remove('active');
            menu.classList.remove('active');
        });
    });

    class VetoSystem {
        constructor() {
            this.maps = ['Ancient', 'Anubis', 'Inferno', 'Mirage', 'Nuke', 'Dust2', 'Train'];
            this.currentPhase = 'format-selection';
            this.format = null;
            this.currentTeam = null;
            this.bannedMaps = [];
            this.pickedMaps = [];
            this.mapOrder = [];
            this.sideSelections = {};
            this.vetoOrder = [];
            
            this.init();
        }

        init() {
            this.setupEventListeners();
            this.updateProgress();
            this.restoreState();
        }

        setupEventListeners() {
            // Format selection
            document.querySelectorAll('.format-btn').forEach(btn => {
                btn.addEventListener('click', (e) => this.selectFormat(e.target.dataset.format));
            });

            // Coin flip
            document.querySelector('.flip-button').addEventListener('click', () => this.flipCoin());

            // Map selection
            document.querySelectorAll('.map-item').forEach(map => {
                map.addEventListener('click', (e) => this.handleMapClick(e));
            });

            // Side selection
            document.querySelectorAll('.side').forEach(side => {
                side.addEventListener('click', (e) => this.handleSideSelection(e));
            });

            // Reset button
            document.querySelector('.reset-button').addEventListener('click', () => this.reset());
        }

        selectFormat(format) {
            this.format = format;
            this.switchPhase('team-assignment');
        }

        flipCoin() {
            const coin = document.querySelector('.coin');
            const flipButton = document.querySelector('.flip-button');
            const tossResult = document.querySelector('.toss-result');
            
            // Reset and hide result text
            tossResult.textContent = '';
            tossResult.classList.remove('show');
            
            // Disable button during animation
            flipButton.disabled = true;
            
            // Random number of full rotations (3-5) plus either 0 or 180 degrees
            const rotations = (Math.floor(Math.random() * 3) + 3) * 360;
            const extraRotation = Math.random() < 0.5 ? 0 : 180;
            const totalRotation = rotations + extraRotation;
            
            // Add animation class
            coin.style.transform = `rotateY(${totalRotation}deg)`;
            
            // Determine winner based on final rotation
            this.currentTeam = extraRotation === 0 ? 'Team A' : 'Team B';
            
            // Wait for coin flip animation to complete
            setTimeout(() => {
                // Show winner message
                tossResult.textContent = `${this.currentTeam} wins the toss!`;
                tossResult.classList.add('show');
                
                // Wait additional 3 seconds before moving to ban phase
                setTimeout(() => {
                    flipButton.disabled = false;
                    this.switchPhase('ban-phase');
                    this.updateTurnIndicator();
                }, 3000);
            }, 1500);
        }

        getVetoRules() {
            switch(this.format) {
                case 'bo1':
                    return {
                        sequence: [
                            { type: 'ban', team: 1 },  // Team A bans first
                            { type: 'ban', team: 2 },  // Team B bans
                            { type: 'ban', team: 1 },  // Team A bans
                            { type: 'ban', team: 2 },  // Team B bans
                            { type: 'ban', team: 2 },  // Team B bans
                            { type: 'ban', team: 1 },  // Team A bans
                            { type: 'remaining', team: null }  // Last map is played
                        ]
                    };
                case 'bo3':
                    return {
                        sequence: [
                            { type: 'ban', team: 1 },   // Team A bans first
                            { type: 'ban', team: 2 },   // Team B bans
                            { type: 'pick', team: 1 },  // Team A picks their map
                            { type: 'pick', team: 2 },  // Team B picks their map
                            { type: 'ban', team: 2 },   // Team B bans
                            { type: 'ban', team: 1 },   // Team A bans
                            { type: 'remaining', team: null }  // Last map is decider
                        ]
                    };
                case 'bo5':
                    return {
                        sequence: [
                            { type: 'ban', team: 1 },  // Team A bans
                            { type: 'ban', team: 2 },  // Team B bans
                            { type: 'pick', team: 1 }, // Team A picks map 1
                            { type: 'pick', team: 2 }, // Team B picks map 2
                            { type: 'pick', team: 1 }, // Team A picks map 3
                            { type: 'pick', team: 2 }, // Team B picks map 4
                            { type: 'remaining', team: null } // Last map becomes map 5
                        ]
                    };
            }
        }

        getCurrentAction() {
            const rules = this.getVetoRules();
            const currentStep = this.vetoOrder.length;
            return rules.sequence[currentStep];
        }

        handleMapClick(e) {
            const map = e.currentTarget;
            if (map.classList.contains('banned') || map.classList.contains('picked')) return;

            const currentAction = this.getCurrentAction();
            if (!currentAction) return;

            if (currentAction.type === 'ban') {
                this.banMap(map);
            } else if (currentAction.type === 'pick' || currentAction.type === 'remaining') {
                this.pickMap(map, currentAction.type === 'remaining');
            }
        }

        banMap(map) {
            map.classList.add('banned');
            const mapName = map.dataset.map;
            this.bannedMaps.push(mapName);
            
            const currentAction = this.getCurrentAction();
            this.vetoOrder.push({
                type: 'ban',
                team: this.currentTeam,
                map: mapName
            });

            // Add to the ban list display
            const banList = document.querySelector(
                `.${this.currentTeam.toLowerCase().replace(' ', '-')}-bans .ban-list`
            );
            const banItem = document.createElement('li');
            banItem.textContent = `Banned ${mapName}`;
            banList.appendChild(banItem);

            this.updateTurnIndicator();
            this.moveToNextTurn();
            this.saveState();
        }

        pickMap(map, isRemaining = false) {
            map.classList.add('picked');
            const mapName = map.dataset.map;
            this.pickedMaps.push(mapName);
            
            this.vetoOrder.push({
                type: isRemaining ? 'remaining' : 'pick',
                team: isRemaining ? null : this.currentTeam,
                map: mapName
            });

            this.mapOrder.push({
                map: mapName,
                picker: isRemaining ? 'Last Map' : this.currentTeam
            });

            // Add to the pick list display
            if (!isRemaining) {
                const pickList = document.querySelector(
                    `.${this.currentTeam.toLowerCase().replace(' ', '-')}-bans .ban-list`
                );
                const pickItem = document.createElement('li');
                pickItem.textContent = `Picked ${mapName}`;
                pickItem.classList.add('pick');
                pickList.appendChild(pickItem);
            }

            // Move to the next turn
            if (this.shouldMoveToBanPhase()) {
                this.moveToNextTurn();
                this.updateTurnIndicator();
            } else if (this.isVetoComplete()) {
                this.switchPhase('side-selection');
                this.showMapOrder();
            } else {
                this.moveToNextTurn();
                this.updateTurnIndicator();
            }
            this.saveState();
        }

        shouldMoveToBanPhase() {
            const rules = this.getVetoRules();
            const nextAction = rules.sequence[this.vetoOrder.length];
            return nextAction && nextAction.type === 'ban';
        }

        isVetoComplete() {
            const rules = this.getVetoRules();
            return this.vetoOrder.length === rules.sequence.length;
        }

        moveToNextTurn() {
            const nextAction = this.getCurrentAction();
            if (!nextAction) return;

            // Set the current team based on the next action's team
            if (nextAction.team === 1) {
                this.currentTeam = 'Team A';
            } else if (nextAction.team === 2) {
                this.currentTeam = 'Team B';
            }
        }

        updateTurnIndicator() {
            const indicator = document.querySelector('.turn-indicator');
            const currentAction = this.getCurrentAction();
            
            if (!currentAction) {
                indicator.textContent = 'Veto Complete';
                return;
            }

            if (currentAction.type === 'remaining') {
                indicator.textContent = 'Last Map Remaining';
            } else {
                const team = currentAction.team === 1 ? 'Team A' : 'Team B';
                const action = currentAction.type === 'ban' ? 'ban' : 'pick';
                indicator.textContent = `${team}'s turn to ${action}`;
            }
        }

        showMapOrder() {
            const firstMap = this.mapOrder[0].map;
            const firstMapPicker = this.mapOrder[0].picker;
            // The opposing team picks sides
            const sidePickingTeam = firstMapPicker === 'Team A' ? 'Team B' : 'Team A';
            
            const mapOrderDiv = document.querySelector('.map-order');
            mapOrderDiv.innerHTML = 
                `<span>${sidePickingTeam}</span> select starting side for <span>${firstMap}</span>`;
        }

        handleSideSelection(e) {
            const side = e.currentTarget;
            const currentMapIndex = Object.keys(this.sideSelections).length;
            const currentMap = this.mapOrder[currentMapIndex].map;
            
            // Add new selection
            document.querySelectorAll('.side').forEach(s => s.classList.remove('selected'));
            side.classList.add('selected');
            
            // Store the selection
            this.sideSelections[currentMap] = side.classList.contains('ct') ? 'CT' : 'T';
            
            setTimeout(() => {
                if (Object.keys(this.sideSelections).length === this.mapOrder.length) {
                    this.showSummary();
                } else {
                    // Show which map is next
                    const nextMapIndex = Object.keys(this.sideSelections).length;
                    const nextMap = this.mapOrder[nextMapIndex].map;
                    const nextMapPicker = this.mapOrder[nextMapIndex].picker;
                    
                    // Standard competitive format:
                    // - Team that didn't pick the map gets to choose sides
                    // - For the decider map, Team B chooses side
                    let sidePickingTeam;
                    if (nextMapPicker === 'Last Map') {
                        sidePickingTeam = 'Team B'; // Team B picks side for decider
                    } else {
                        // The opposing team picks sides for picked maps
                        sidePickingTeam = nextMapPicker === 'Team A' ? 'Team B' : 'Team A';
                    }
                    
                    document.querySelector('.map-order').innerHTML = 
                        `<span>${sidePickingTeam}</span> select starting side for <span>${nextMap}</span>`;
                    
                    document.querySelectorAll('.side').forEach(s => s.classList.remove('selected'));
                }
            }, 800);
            this.saveState();
        }

        showSummary() {
            const summary = document.querySelector('.summary-content');
            
            // Sort maps in the order they were picked
            const orderedMaps = [...this.mapOrder].sort((a, b) => {
                // Last map (decider) always goes last
                if (a.picker === 'Last Map') return 1;
                if (b.picker === 'Last Map') return -1;
                
                // Get the index from the vetoOrder for picked maps
                const aIndex = this.vetoOrder.findIndex(v => v.type === 'pick' && v.map === a.map);
                const bIndex = this.vetoOrder.findIndex(v => v.type === 'pick' && v.map === b.map);
                return aIndex - bIndex;
            });

            summary.innerHTML = `
                <div class="format-display">
                    <h3>Match Format: Best of ${this.format === 'bo1' ? '1' : this.format === 'bo3' ? '3' : '5'}</h3>
                </div>
                <div class="maps-summary">
                    ${orderedMaps.map((item, index) => {
                        let mapInfo;
                        if (item.picker === 'Last Map') {
                            mapInfo = `Decider Map - Team B picks ${this.sideSelections[item.map]}`;
                        } else {
                            const pickingTeam = item.picker;
                            const sideTeam = pickingTeam === 'Team A' ? 'Team B' : 'Team A';
                            mapInfo = `${pickingTeam} pick - Team ${sideTeam.split(' ')[1]} picks ${this.sideSelections[item.map]}`;
                        }
                        
                        return `
                            <div class="map-summary-card">
                                <div class="map-number">Map ${index + 1}</div>
                                <div class="map-details">
                                    <div class="map-name">${item.map}</div>
                                    <div class="map-info">
                                        <span class="picker">
                                            ${item.picker === 'Last Map' ? 
                                                '<i class="fas fa-random"></i> Decider Map' : 
                                                `<i class="fas fa-user-check"></i> ${item.picker} Pick`}
                                        </span>
                                        <span class="side">
                                            <i class="fas fa-shield-alt"></i> 
                                            ${mapInfo}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
            this.switchPhase('summary');
        }

        switchPhase(phase) {
            document.querySelectorAll('.phase-container').forEach(container => {
                container.classList.remove('active');
            });
            document.querySelector(`.${phase}`).classList.add('active');
            this.currentPhase = phase;
            this.updateProgress();
            this.saveState();
        }

        updateProgress() {
            const steps = ['format-selection', 'team-assignment', 'ban-phase', 'map-selection', 'side-selection'];
            const currentIndex = steps.indexOf(this.currentPhase);
            
            document.querySelectorAll('.progress-step').forEach((step, index) => {
                step.classList.toggle('active', index <= currentIndex);
            });
        }

        reset() {
            this.currentPhase = 'format-selection';
            this.currentTeam = null;
            this.bannedMaps = [];
            this.pickedMaps = [];
            this.mapOrder = [];
            this.sideSelections = {};
            this.vetoOrder = [];
            
            // Clear all map states
            document.querySelectorAll('.map-item').forEach(card => {
                card.classList.remove('banned', 'picked');
            });
            
            // Clear all side selections
            document.querySelectorAll('.side').forEach(side => {
                side.classList.remove('selected');
            });

            // Clear ban lists
            document.querySelectorAll('.ban-list').forEach(list => {
                list.innerHTML = '';
            });

            // Reset coin rotation
            const coin = document.querySelector('.coin');
            coin.style.transform = 'rotateY(0deg)';

            // Clear turn indicator
            const indicator = document.querySelector('.turn-indicator');
            if (indicator) {
                indicator.textContent = '';
            }

            // Clear map order display
            const mapOrder = document.querySelector('.map-order');
            if (mapOrder) {
                mapOrder.innerHTML = '';
            }

            // Clear summary content
            const summary = document.querySelector('.summary-content');
            if (summary) {
                summary.innerHTML = '';
            }
            
            // Clear toss result
            const tossResult = document.querySelector('.toss-result');
            if (tossResult) {
                tossResult.textContent = '';
                tossResult.classList.remove('show');
            }
            
            this.switchPhase('format-selection');
            sessionStorage.removeItem('vetoState');
        }

        saveState() {
            const state = {
                currentPhase: this.currentPhase,
                format: this.format,
                currentTeam: this.currentTeam,
                bannedMaps: this.bannedMaps,
                pickedMaps: this.pickedMaps,
                mapOrder: this.mapOrder,
                sideSelections: this.sideSelections,
                vetoOrder: this.vetoOrder
            };
            sessionStorage.setItem('vetoState', JSON.stringify(state));
        }

        restoreState() {
            const savedState = sessionStorage.getItem('vetoState');
            if (!savedState) return;

            const state = JSON.parse(savedState);
            
            // Restore all state properties
            Object.assign(this, state);

            // Restore UI state
            if (this.currentPhase !== 'format-selection') {
                this.switchPhase(this.currentPhase);
                
                // Restore banned/picked maps
                this.bannedMaps.forEach(mapName => {
                    const mapElement = document.querySelector(`[data-map="${mapName}"]`);
                    if (mapElement) mapElement.classList.add('banned');
                });
                
                this.pickedMaps.forEach(mapName => {
                    const mapElement = document.querySelector(`[data-map="${mapName}"]`);
                    if (mapElement) mapElement.classList.add('picked');
                });

                // Restore ban lists
                this.vetoOrder.forEach(veto => {
                    if (veto.team) {
                        const banList = document.querySelector(
                            `.${veto.team.toLowerCase().replace(' ', '-')}-bans .ban-list`
                        );
                        if (banList) {
                            const item = document.createElement('li');
                            item.textContent = `${veto.type === 'ban' ? 'Banned' : 'Picked'} ${veto.map}`;
                            if (veto.type === 'pick') item.classList.add('pick');
                            banList.appendChild(item);
                        }
                    }
                });

                // Restore turn indicator
                this.updateTurnIndicator();

                // If in side selection, restore map order display
                if (this.currentPhase === 'side-selection') {
                    this.showMapOrder();
                }

                // If in summary, restore summary display
                if (this.currentPhase === 'summary') {
                    this.showSummary();
                }

                // Scroll to veto section
                const vetoSection = document.getElementById('veto');
                if (vetoSection) {
                    vetoSection.scrollIntoView({ behavior: 'smooth' });
                }
            }
        }
    }

    // Initialize the veto system when the page loads
    new VetoSystem();

    // Add this to handle page load
    window.addEventListener('load', () => {
        const vetoSection = document.getElementById('veto');
        const savedState = sessionStorage.getItem('vetoState');
        
        if (savedState) {
            const state = JSON.parse(savedState);
            if (state.currentPhase !== 'format-selection' && vetoSection) {
                vetoSection.scrollIntoView({ behavior: 'smooth' });
            }
        }
    });

    // Add this at the bottom of your script, just before the closing });
    window.addEventListener('load', () => {
        // First, check if there's a saved veto state
        const savedState = sessionStorage.getItem('vetoState');
        
        if (savedState) {
            const state = JSON.parse(savedState);
            if (state.currentPhase !== 'format-selection') {
                // If we're in the middle of a veto, scroll to veto section
                const vetoSection = document.getElementById('veto');
                if (vetoSection) {
                    vetoSection.scrollIntoView({ behavior: 'smooth' });
                }
            } else {
                // If we're not in a veto or at the start, scroll to top
                window.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                });
            }
        } else {
            // If no saved state, always scroll to top
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        }
    });

    // Also add this to force scroll to top when using browser navigation
    window.addEventListener('beforeunload', () => {
        // Store the current scroll position
        sessionStorage.setItem('scrollPosition', '0');
    });
}); 