module.exports = (req, res) => {
  res.status(200).json({ ok: true, route: '/api/health', env: !!process.env.OPENAI_API_KEY });
};
