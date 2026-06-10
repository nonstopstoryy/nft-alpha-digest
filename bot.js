require('dotenv').config();
const fs = require('fs');

const OPENROUTER_KEY = process.env.OPENAI_API_KEY;
const TODAY = new Date().toISOString().split('T')[0];

const NETWORKS = {
  ethereum: 'Ethereum',
  base: 'Base',
  shape: 'Shape'
};

async function fetchWithRetry(url, options, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const { default: fetch } = await import('node-fetch');
      const res = await fetch(url, options);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

async function analyzeNetwork(network, networkName) {
  console.log('Analyzing ' + networkName + '...');

  const prompt = `You are a professional NFT market analyst. Today is ${TODAY}.

Analyze the TOP 25 NFT collections on ${networkName} network and provide a DEEP research report.

For each collection provide:
1. Collection name and contract
2. Floor Price (ETH/native token) + 24h change %
3. Volume 24h + 7d trend
4. Holder Concentration Score (1-10, 10=most concentrated/risky)
5. Wash Trading Signal (Low/Medium/High/Critical) with reasoning
6. Dormant Wallet Activity (any OG wallets moving? yes/no + details)
7. Sentiment Fingerprint:
   - FOMO Index (0-100)
   - FUD Index (0-100)  
   - Dead Project Risk (Low/Medium/High)
   - Community Belief vs Flip ratio
8. Early Alpha Score (0-100) — anomalies visible 24-48h before market notices
9. Cross-collection correlation (which other collections move with this one)
10. Narrative Tag: [AI-NFT / Gaming / RWA / PFP / Art / Utility / Meme]
11. 1-paragraph analyst verdict: BUY SIGNAL / WATCH / AVOID + reasoning

After the top 25, provide:
## NETWORK SUMMARY
- Top 3 Early Alpha picks with reasoning
- Biggest risk to avoid today
- Dominant narrative this week
- Overall network health score (1-10)

Format as clean markdown. Be specific with numbers. No generic statements.`;

  const data = await fetchWithRetry('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + OPENROUTER_KEY,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/nonstopstoryy/nft-alpha-digest',
      'X-Title': 'NFT Alpha Digest'
    },
    body: JSON.stringify({
      model: 'openrouter/auto',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  return data.choices[0].message.content;
}

async function generateSummary(reports) {
  console.log('Generating cross-chain summary...');

  const prompt = `You are a senior NFT market strategist. Today is ${TODAY}.

Based on these three network reports, create a CROSS-CHAIN ALPHA SUMMARY:

${Object.entries(reports).map(([net, rep]) => '=== ' + net.toUpperCase() + ' ===\n' + rep.substring(0, 1000)).join('\n\n')}

Provide:
## 🏆 TOP 5 ALPHA PICKS ACROSS ALL CHAINS
(best opportunities across Ethereum + Base + Shape today)

## ⚠️ TOP 3 RISKS TO AVOID
(wash trading, dumps, dead projects)

## 🌊 NARRATIVE MOMENTUM INDEX
- Which narratives are rising vs dying across all chains
- Cross-chain correlation patterns

## 📊 MARKET HEALTH DASHBOARD
- Ethereum NFT health: X/10
- Base NFT health: X/10  
- Shape NFT health: X/10
- Overall sentiment: Bullish/Neutral/Bearish

## 💡 CONTRARIAN PLAY OF THE DAY
(something the market is sleeping on)

## 🔮 24H PREDICTION
What to watch in next 24 hours

Format as clean markdown with emojis. Be bold and specific.`;

  const data = await fetchWithRetry('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + OPENROUTER_KEY,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/nonstopstoryy/nft-alpha-digest',
      'X-Title': 'NFT Alpha Digest'
    },
    body: JSON.stringify({
      model: 'openrouter/auto',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  return data.choices[0].message.content;
}

async function main() {
  console.log('NFT Alpha Digest starting for ' + TODAY);
  
  const dir = 'reports/' + TODAY;
  fs.mkdirSync(dir, { recursive: true });

  const reports = {};

  for (const [network, networkName] of Object.entries(NETWORKS)) {
    try {
      reports[network] = await analyzeNetwork(network, networkName);
      fs.writeFileSync(dir + '/' + network + '-top25.md', 
        '# ' + networkName + ' Top 25 NFT Collections — ' + TODAY + '\n\n' + reports[network]);
      console.log(networkName + ' report saved');
      await new Promise(r => setTimeout(r, 1000));
    } catch (e) {
      console.error(networkName + ' failed:', e.message);
      reports[network] = 'Analysis failed: ' + e.message;
    }
  }

  const summary = await generateSummary(reports);
  fs.writeFileSync(dir + '/summary.md',
    '# NFT Alpha Digest — Cross-Chain Summary ' + TODAY + '\n\n' + summary);
  console.log('Summary saved');

  const index = '# NFT Alpha Digest\n\n' +
    '> Daily AI-powered research on top 25 NFT collections across Ethereum, Base & Shape\n\n' +
    '## Latest Report: ' + TODAY + '\n\n' +
    '| Network | Report |\n|---------|--------|\n' +
    Object.keys(NETWORKS).map(n => '| ' + NETWORKS[n] + ' | [View](' + dir + '/' + n + '-top25.md) |').join('\n') +
    '\n| 🌐 Cross-Chain Summary | [View](' + dir + '/summary.md) |\n\n' +
    '_Updated daily at 08:00 UTC_\n';

  fs.writeFileSync('LATEST.md', index);
  console.log('All done! Reports saved to ' + dir);
}

main().catch(console.error);