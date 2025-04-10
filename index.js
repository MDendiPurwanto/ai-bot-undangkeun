const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const axios = require('axios');

const client = new Client();

// Objek untuk melacak status pengguna (apakah LLM aktif atau tidak)
const userStatus = new Map(); // Key: user ID, Value: { autoResponse: true/false }

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('Scan QR code di atas.');
});

client.on('ready', () => {
    console.log('Bot sudah siap!');
});

// Fungsi untuk memanggil Mistral Small dengan data.json sebagai konteks
async function getLLMResponse(message, data) {
    try {
        const context = `
            Informasi dari deonesolutions.myr:
            - Judul: ${data.title}
            - Deskripsi: ${data.metaDescription}
            - Heading Utama: ${data.headings.h1.join(', ') || 'Tidak ada'}
            - Paragraf: ${data.paragraphs.join(' ') || 'Tidak ada'}
            - Spans: ${data.spans.join(', ') || 'Tidak ada'}
            - Teks Lengkap (dipotong): ${data.fullBodyText.slice(0, 500)}...
        `;

        const messages = [
            {
                role: "system",
                content: `
                    Anda adalah customer service yang ramah, profesional, dan membantu dari deonesolutions.myr.
                    Gunakan data berikut sebagai referensi: "${context}"
                    Jawab pertanyaan pengguna dengan natural, singkat, dan jelas seperti CS manusia.
                    Jika relevan, rangkum informasi dari data tersebut.
                    Selalu gunakan bahasa Indonesia formal.
                `
            },
            {
                role: "user",
                content: message
            }
        ];

        const response = await axios.post(
            'https://api.mistral.ai/v1/chat/completions',
            {
                model: 'mistral-small',
                messages: messages,
                max_tokens: 131000,
                temperature: 0.6
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`
                },
                timeout: 15000
            }
        );
        return response.data.choices[0]?.message?.content.trim() || 'Maaf, saya bingung. Bisa tanyakan lagi?';
    } catch (error) {
        console.error('Error LLM:', error.message);
        return 'Maaf, ada kendala teknis. Silakan coba lagi nanti ya!';
    }
}

// Fungsi untuk mengecek apakah pengguna ingin ke CS asli
function isRequestingHumanCS(message) {
    const lowerMsg = message.toLowerCase();
    return lowerMsg.includes('hubungi cs') || 
           lowerMsg.includes('cs asli') || 
           lowerMsg.includes('bicara dengan manusia') || 
           lowerMsg.includes('cs manusia');
}

client.on('message', async (message) => {
    console.log('Pesan diterima:', message.body);
    const userId = message.from; // ID unik pengguna (nomor WhatsApp)

    // Inisialisasi status pengguna jika belum ada
    if (!userStatus.has(userId)) {
        userStatus.set(userId, { autoResponse: true });
    }

    const user = userStatus.get(userId);

    // Cek apakah pengguna meminta CS asli
    if (isRequestingHumanCS(message.body)) {
        user.autoResponse = false; // Hentikan auto response
        userStatus.set(userId, user);
        message.reply('Baik, saya akan menghubungkan Anda dengan CS asli. Mohon tunggu sebentar ya!');
        return; // Stop eksekusi lebih lanjut
    }

    // Jika auto response masih aktif, gunakan LLM
    if (user.autoResponse) {
        const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
        const reply = await getLLMResponse(message.body, data);
        message.reply(reply);
    }
    // Jika auto response mati, tidak ada balasan otomatis
});

client.initialize();