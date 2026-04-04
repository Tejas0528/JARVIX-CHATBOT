from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import requests
import os

app = Flask(__name__)
CORS(app)

# 🔐 Use ENV variable (IMPORTANT for Vercel)
OPENROUTER_API_KEY = os.environ.get("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")


# ══════════════════════════════════════════════
# 🤖 CHAT API
# ══════════════════════════════════════════════
@app.route("/chat", methods=["POST"])
def chat():
    try:
        data = request.get_json(force=True)

        if not data or "message" not in data:
            return jsonify({"reply": "Invalid request"})

        user_message = data["message"].strip()

        if not user_message:
            return jsonify({"reply": "Type something..."})

        if user_message.lower() == "test":
            return jsonify({"reply": "Backend working perfectly!"})

        response = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": "openai/gpt-3.5-turbo",
                "messages": [
                    {"role": "system", "content": "You are JARVIS, a helpful AI assistant."},
                    {"role": "user", "content": user_message}
                ]
            },
            timeout=15
        )

        if response.status_code != 200:
            return jsonify({"reply": "API error. Check key or limit."})

        result = response.json()

        reply = None
        if "choices" in result and len(result["choices"]) > 0:
            message = result["choices"][0].get("message", {})
            reply = message.get("content", None)

        if not reply:
            return jsonify({"reply": "No valid response from AI"})

        return jsonify({"reply": reply})

    except Exception as e:
        print("SERVER ERROR:", e)
        return jsonify({"reply": "Server error"})


# ══════════════════════════════════════════════
# 🌍 TRANSLATION API
# ══════════════════════════════════════════════
@app.route("/translate", methods=["GET"])
def translate():
    try:
        text = request.args.get("text", "")
        langpair = request.args.get("langpair", "en|ta")

        if not text:
            return jsonify({"translated": "", "ok": False})

        url = "https://api.mymemory.translated.net/get"
        resp = requests.get(url, params={"q": text, "langpair": langpair}, timeout=8)
        data = resp.json()
        translated = data.get("responseData", {}).get("translatedText", "")

        bad = ["MYMEMORY WARNING", "PLEASE SELECT", "INVALID LANGUAGE PAIR"]
        if any(b in translated for b in bad):
            translated = text

        return jsonify({"translated": translated, "ok": True})

    except Exception as e:
        print("TRANSLATE ERROR:", e)
        return jsonify({"translated": request.args.get("text", ""), "ok": False})


# ══════════════════════════════════════════════
# 🔊 TTS API
# ══════════════════════════════════════════════
@app.route("/tts", methods=["GET"])
def tts_proxy():
    try:
        text = request.args.get("text", "")
        lang = request.args.get("lang", "ta")

        if not text:
            return Response("", status=400)

        url = (
            f"https://translate.google.com/translate_tts"
            f"?ie=UTF-8&q={requests.utils.quote(text)}&tl={lang}&client=tw-ob"
        )

        headers = {
            "User-Agent": "Mozilla/5.0",
            "Referer": "https://translate.google.com/",
        }

        resp = requests.get(url, headers=headers, timeout=12, stream=True)

        def generate():
            for chunk in resp.iter_content(chunk_size=4096):
                yield chunk

        return Response(
            generate(),
            status=resp.status_code,
            content_type="audio/mpeg",
            headers={
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "no-cache",
            }
        )

    except Exception as e:
        print("TTS ERROR:", e)
        return Response("", status=500)


# ══════════════════════════════════════════════
# 🔥 VERCEL HANDLER (VERY IMPORTANT)
# ══════════════════════════════════════════════
def handler(request):
    return app(request.environ, lambda *args: None)
