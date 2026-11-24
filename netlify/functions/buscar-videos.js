exports.handler = async (event) => {
    const { termo } = event.queryStringParameters;
    if (!termo) return { statusCode: 400, body: "Termo é obrigatório." };

    const apiKey = process.env.YOUTUBE_API_KEY;
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(termo + ' pet resolucao')}&type=video&maxResults=3&key=${apiKey}`;

    try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        
        const videos = data.items.map(item => ({
            videoId: item.id.videoId, titulo: item.snippet.title, url: `https://www.youtube.com/watch?v=${item.id.videoId}`
        }));
        return { statusCode: 200, body: JSON.stringify(videos) };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};