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
            this.maps = ['Ancient', 'Anubis', 'Inferno', 'Mirage', 'Nuke', 'Overpass', 'Vertigo'];
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
            
            // Disable button during animation
            flipButton.disabled = true;
            
            // Random number of full rotations (3-5) plus either 0 or 180 degrees
            const rotations = (Math.floor(Math.random() * 3) + 3) * 360;
            const extraRotation = Math.random() < 0.5 ? 0 : 180;
            const totalRotation = rotations + extraRotation;
            
            coin.style.transform = `rotateY(${totalRotation}deg)`;
            
            // Determine winner based on final rotation
            this.currentTeam = extraRotation === 0 ? 'Team A' : 'Team B';
            
            // Wait for animation to complete
            setTimeout(() => {
                flipButton.disabled = false;
                this.switchPhase('ban-phase');
                this.updateTurnIndicator();
            }, 1500);
        }

        getVetoRules() {
            switch(this.format) {
                case 'bo1':
                    return {
                        sequence: [
                            { type: 'ban', team: 1 },
                            { type: 'ban', team: 2 },
                            { type: 'ban', team: 1 },
                            { type: 'ban', team: 2 },
                            { type: 'ban', team: 2 },
                            { type: 'pick', team: 1 }
                        ]
                    };
                case 'bo3':
                    return {
                        sequence: [
                            { type: 'ban', team: 1 },
                            { type: 'ban', team: 2 },
                            { type: 'pick', team: 1 },
                            { type: 'pick', team: 2 },
                            { type: 'ban', team: 1 },
                            { type: 'ban', team: 2 },
                            { type: 'decider', team: null }
                        ]
                    };
                case 'bo5':
                    return {
                        sequence: [
                            { type: 'ban', team: 1 },
                            { type: 'ban', team: 2 },
                            { type: 'pick', team: 1 },
                            { type: 'pick', team: 2 },
                            { type: 'pick', team: 1 },
                            { type: 'pick', team: 2 },
                            { type: 'decider', team: null }
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
            } else if (currentAction.type === 'pick' || currentAction.type === 'decider') {
                this.pickMap(map, currentAction.type === 'decider');
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
        }

        pickMap(map, isDecider = false) {
            map.classList.add('picked');
            const mapName = map.dataset.map;
            this.pickedMaps.push(mapName);
            
            this.vetoOrder.push({
                type: isDecider ? 'decider' : 'pick',
                team: isDecider ? null : this.currentTeam,
                map: mapName
            });

            this.mapOrder.push({
                map: mapName,
                picker: isDecider ? 'Decider' : this.currentTeam
            });

            // Add to the pick list display
            if (!isDecider) {
                const pickList = document.querySelector(
                    `.${this.currentTeam.toLowerCase().replace(' ', '-')}-bans .ban-list`
                );
                const pickItem = document.createElement('li');
                pickItem.textContent = `Picked ${mapName}`;
                pickItem.classList.add('pick');
                pickList.appendChild(pickItem);
            }

            if (this.shouldMoveToBanPhase()) {
                this.updateTurnIndicator();
                this.moveToNextTurn();
            } else if (this.isVetoComplete()) {
                this.switchPhase('side-selection');
                this.showMapOrder();
            }
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

            const team = currentAction.team === 1 ? 'Team A' : 'Team B';
            const action = currentAction.type === 'ban' ? 'ban' : 'pick';
            
            if (currentAction.type === 'decider') {
                indicator.textContent = 'Decider Map';
            } else {
                indicator.textContent = `${team}'s turn to ${action}`;
            }
        }

        showMapOrder() {
            const mapOrderDiv = document.querySelector('.map-order');
            mapOrderDiv.innerHTML = this.mapOrder.map((item, index) => 
                `<div class="map-order-item">Map ${index + 1}: ${item.map} (Picked by ${item.picker})</div>`
            ).join('');
        }

        handleSideSelection(e) {
            const side = e.currentTarget;
            const currentMapIndex = Object.keys(this.sideSelections).length;
            const currentMap = this.mapOrder[currentMapIndex].map;
            
            // Remove previous selection for current map if exists
            document.querySelectorAll('.side').forEach(s => s.classList.remove('selected'));
            
            // Add new selection
            side.classList.add('selected');
            this.sideSelections[currentMap] = side.classList.contains('ct') ? 'CT' : 'T';
            
            // Wait a moment before moving to next map or summary
            setTimeout(() => {
                if (Object.keys(this.sideSelections).length === this.mapOrder.length) {
                    this.showSummary();
                } else {
                    // Reset selection for next map
                    document.querySelectorAll('.side').forEach(s => s.classList.remove('selected'));
                }
            }, 500);
        }

        showSummary() {
            const summary = document.querySelector('.summary-content');
            summary.innerHTML = `
                <h3>Match Format: Best of ${this.format === 'bo1' ? '1' : this.format === 'bo3' ? '3' : '5'}</h3>
                ${this.mapOrder.map((item, index) => `
                    <div class="map-summary">
                        <p>Map ${index + 1}: ${item.map}</p>
                        <p>Picked by: ${item.picker}</p>
                        <p>Starting Side: ${this.sideSelections[item.map]}</p>
                    </div>
                `).join('')}
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
            
            document.querySelectorAll('.map-card').forEach(card => {
                card.classList.remove('banned', 'picked');
            });
            
            document.querySelectorAll('.side').forEach(side => {
                side.classList.remove('selected');
            });
            
            this.switchPhase('format-selection');
        }
    }

    // Initialize the veto system when the page loads
    new VetoSystem();
}); 