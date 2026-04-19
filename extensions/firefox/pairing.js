// AuraSafe Pairing Page Script (Firefox Compatible)
// Version: 2.0.0

// ===================== CROSS-BROWSER COMPATIBILITY =====================
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
const storage = browserAPI.storage;
const runtime = browserAPI.runtime;

document.addEventListener("DOMContentLoaded", () => {
    const pairingCodeInput = document.getElementById('pairingCode');
    const pairBtn = document.getElementById('pairBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const statusDiv = document.getElementById('status');

    if (!pairBtn || !cancelBtn || !pairingCodeInput || !statusDiv) {
        console.error("Pairing UI elements not found in DOM");
        return;
    }

    function showStatus(message, type = 'info') {
        statusDiv.textContent = message;
        statusDiv.className = `status ${type}`;
        statusDiv.style.display = 'block';
    }

    // ===================== PORT DETECTION =====================
    async function getWebSocketPort() {
        const ports = [3456, 8765, 58461, 5000, 7000, 3000, 3001];

        for (const port of ports) {
            try {
                const ok = await new Promise((resolve) => {
                    const ws = new WebSocket(`ws://localhost:${port}`);

                    const timeout = setTimeout(() => {
                        ws.close();
                        resolve(false);
                    }, 800);

                    ws.onopen = () => {
                        clearTimeout(timeout);
                        ws.close();
                        resolve(true);
                    };

                    ws.onerror = () => {
                        clearTimeout(timeout);
                        resolve(false);
                    };
                });

                if (ok) return port;
            } catch (e) {
                // ignore and continue
            }
        }

        return null;
    }

    // ===================== CONNECTION TEST =====================
    async function testConnection(secret) {
        const port = await getWebSocketPort();

        if (!port) return false;

        return new Promise((resolve) => {
            const ws = new WebSocket(`ws://localhost:${port}?token=${secret}`);

            const timeout = setTimeout(() => {
                ws.close();
                resolve(false);
            }, 3000);

            ws.onopen = () => {
                clearTimeout(timeout);
                ws.close();
                resolve(true);
            };

            ws.onerror = () => {
                clearTimeout(timeout);
                resolve(false);
            };
        });
    }

    // ===================== PAIR BUTTON =====================
    pairBtn.addEventListener('click', async () => {
        const code = pairingCodeInput.value.trim();

        if (!code) {
            showStatus('Please enter a pairing code', 'error');
            return;
        }

        pairBtn.disabled = true;
        pairBtn.textContent = 'Pairing...';
        showStatus('Connecting to AuraSafe desktop...', 'info');

        try {
            const ok = await testConnection(code);

            if (ok) {
                // ===================== SAVE STATE (SOURCE OF TRUTH) =====================
                // Firefox uses storage.local.set (same as Chrome via wrapper)
                await storage.local.set({
                    aurasafe_secret: code,
                    aurasafe_paired: true,
                    aurasafe_connection_status: {
                        status: "connected"
                    },
                    aurasafe_pair_date: Date.now()
                });

                // ===================== SYNC BACKGROUND =====================
                // Firefox uses runtime.sendMessage (same as Chrome via wrapper)
                runtime.sendMessage({
                    type: "SET_STATUS",
                    payload: {
                        status: "connected",
                        secret: code
                    }
                }).catch(() => { });

                showStatus('✅ Paired successfully', 'success');

                setTimeout(() => window.close(), 1500);

            } else {
                showStatus('❌ Could not connect to desktop app', 'error');

                // reset state on failure
                await storage.local.set({
                    aurasafe_connection_status: {
                        status: "disconnected",
                        secret: code,
                        paired: true,
                        lastSync: Date.now()
                    }
                });
            }

        } catch (err) {
            console.error(err);
            showStatus('❌ Unexpected error during pairing', 'error');
        } finally {
            pairBtn.disabled = false;
            pairBtn.textContent = '🔗 Pair Extension';
        }
    });

    // ===================== CANCEL =====================
    cancelBtn.addEventListener('click', () => window.close());

    // ===================== ENTER KEY SUPPORT =====================
    pairingCodeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') pairBtn.click();
    });
});