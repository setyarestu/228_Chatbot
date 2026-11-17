const chat = document.getElementById("chat");
const empty = document.getElementById("empty");
const form = document.getElementById("form");
const input = document.getElementById("input");
const sendBtn = document.getElementById("sendBtn");
const resetBtn = document.getElementById("resetBtn");

// Riwayat percakapan yang dikirim ke server
let messages = [];
let isSending = false;

function addMessage(role, text = "") {
    if (empty) empty.style.display = "none";

    const div = document.createElement("div");
    div.className = "msg " + (role === "user" ? "user" : "bot");
    div.textContent = text;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
    return div;
}

function setSending(state) {
    isSending = state;
    sendBtn.disabled = state;
    input.disabled = state;
    if (!state) input.focus();
}

function autoResize() {
    input.style.height = "auto";
    input.style.height = input.scrollHeight + "px";
}

async function sendMessage(text) {
    messages.push({ role: "user", content: text });
    addMessage("user", text);

    const botDiv = addMessage("bot");
    botDiv.classList.add("typing");

    let reply = "";

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(
                typeof err.error === "string" ? err.error : "Server mengembalikan status " + response.status
            );
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let finished = false;

        while (!finished) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop();

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed.startsWith("data:")) continue;

                const data = trimmed.slice(5).trim();
                if (data === "[DONE]") {
                    finished = true;
                    break;
                }

                try {
                    const parsed = JSON.parse(data);

                    if (parsed && parsed.error) {
                        throw new Error(parsed.error);
                    }

                    reply += parsed;
                    botDiv.textContent = reply;
                    chat.scrollTop = chat.scrollHeight;
                } catch (err) {
                    if (err instanceof SyntaxError) continue;
                    throw err;
                }
            }
        }

        if (reply) {
            messages.push({ role: "assistant", content: reply });
        } else {
            botDiv.textContent = "Tidak ada jawaban dari server. Coba kirim ulang.";
            botDiv.classList.add("error");
            messages.pop();
        }
    } catch (error) {
        botDiv.textContent = "Gagal mengirim pesan: " + error.message;
        botDiv.classList.add("error");
        // Hapus pesan user terakhir supaya riwayat tetap konsisten
        if (!reply) messages.pop();
    } finally {
        botDiv.classList.remove("typing");
    }
}

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || isSending) return;

    input.value = "";
    autoResize();
    setSending(true);
    await sendMessage(text);
    setSending(false);
});

// Enter untuk kirim, Shift+Enter untuk baris baru
input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        form.requestSubmit();
    }
});

input.addEventListener("input", autoResize);

resetBtn.addEventListener("click", () => {
    if (isSending) return;
    messages = [];
    chat.querySelectorAll(".msg").forEach((el) => el.remove());
    if (empty) empty.style.display = "";
    input.focus();
});