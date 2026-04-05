-- =============================================================================
-- 004: Seed initial 60+ sources
-- =============================================================================

-- RESEARCH & PAPERS
INSERT INTO sources (name, url, category, type, status, platform, fetch_frequency, reliability_score, notes) VALUES
('ArXiv -- cs.AI',           'https://arxiv.org/list/cs.AI',             'research', 'api',   'active', 'arxiv',             'daily',     4.50, 'AI section of ArXiv'),
('ArXiv -- cs.LG',           'https://arxiv.org/list/cs.LG',             'research', 'api',   'active', 'arxiv',             'daily',     4.50, 'Machine Learning section'),
('ArXiv -- cs.CL',           'https://arxiv.org/list/cs.CL',             'research', 'api',   'active', 'arxiv',             'daily',     4.50, 'Computation and Language (NLP)'),
('ArXiv -- cs.CV',           'https://arxiv.org/list/cs.CV',             'research', 'api',   'active', 'arxiv',             'daily',     4.50, 'Computer Vision section'),
('Semantic Scholar',          'https://semanticscholar.org',              'research', 'api',   'active', 'semantic_scholar',  'daily',     4.00, 'Paper search and citation tracking with TLDRs'),
('Papers With Code',          'https://paperswithcode.com',               'research', 'api',   'active', 'papers_with_code',  'daily',     4.50, 'Papers linked to code repos and benchmarks'),
('OpenReview',                'https://openreview.net',                   'research', 'api',   'active', 'openreview',        'weekly',    4.00, 'Conference submissions and reviews'),
('Hugging Face Papers',       'https://huggingface.co/papers',            'research', 'api',   'active', 'huggingface',       'daily',     4.50, 'Daily curated ML papers');

-- SOCIAL & COMMUNITY
INSERT INTO sources (name, url, category, type, status, platform, fetch_frequency, reliability_score, notes) VALUES
('Reddit -- r/MachineLearning', 'https://reddit.com/r/MachineLearning',  'social',   'api',   'active', 'reddit',            'every_4h',  4.50, 'Premier ML community on Reddit'),
('Reddit -- r/LocalLLaMA',      'https://reddit.com/r/LocalLLaMA',       'social',   'api',   'active', 'reddit',            'every_4h',  4.00, 'Local and open-source LLM discussion'),
('Reddit -- r/artificial',      'https://reddit.com/r/artificial',        'social',   'api',   'active', 'reddit',            'every_4h',  3.50, 'General AI discussion'),
('Reddit -- r/singularity',     'https://reddit.com/r/singularity',       'social',   'api',   'active', 'reddit',            'every_4h',  3.00, 'Future of AI / AGI speculation'),
('Hacker News',                 'https://news.ycombinator.com',           'social',   'api',   'active', 'hackernews',        'every_4h',  4.50, 'AI-tagged posts via Algolia API'),
('Lobsters',                    'https://lobste.rs',                      'social',   'api',   'active', 'lobsters',          'every_6h',  4.00, 'Curated tech community, ai/ml tags');

-- CODE & OPEN SOURCE
INSERT INTO sources (name, url, category, type, status, platform, fetch_frequency, reliability_score, notes) VALUES
('GitHub Trending',               'https://github.com/trending',            'code', 'api',   'active', 'github',     'every_6h',  4.00, 'Trending ML/AI repos'),
('GitHub Releases (tracked)',     'https://github.com',                     'code', 'api',   'active', 'github',     'every_6h',  4.00, 'Release pages of tracked repos'),
('Hugging Face Models',           'https://huggingface.co/models',          'code', 'api',   'active', 'huggingface','daily',     4.50, 'New model uploads'),
('Hugging Face Spaces',           'https://huggingface.co/spaces',          'code', 'api',   'active', 'huggingface','daily',     4.00, 'Interactive demos'),
('PyPI -- AI Packages',           'https://pypi.org',                       'code', 'rss',   'active', 'pypi',       'daily',     3.50, 'New AI-related Python packages'),
('Ollama Library',                'https://ollama.com/library',             'code', 'scrape','active', 'ollama',     'daily',     4.00, 'Local model releases');

-- NEWS & BLOGS
INSERT INTO sources (name, url, category, type, status, platform, fetch_frequency, reliability_score, notes) VALUES
('The Batch (Andrew Ng)',         'https://www.deeplearning.ai/the-batch/',       'news', 'rss', 'active', 'newsletter', 'daily',     4.50, 'Weekly AI newsletter by Andrew Ng'),
('Import AI (Jack Clark)',        'https://importai.substack.com',                'news', 'rss', 'active', 'newsletter', 'daily',     4.50, 'Weekly AI research roundup'),
('The Gradient',                  'https://thegradient.pub',                      'news', 'rss', 'active', 'blog',       'daily',     4.00, 'Long-form AI analysis'),
('Ahead of AI (Sebastian Raschka)', 'https://magazine.sebastianraschka.com',      'news', 'rss', 'active', 'newsletter', 'daily',     4.50, 'Deep dives into LLM research'),
('Simon Willison''s Blog',        'https://simonwillison.net',                    'news', 'rss', 'active', 'blog',       'daily',     4.50, 'LLMs, AI tools, open source'),
('Lil''Log (Lilian Weng)',        'https://lilianweng.github.io',                 'news', 'rss', 'active', 'blog',       'weekly',    5.00, 'Deep technical posts on ML/AI'),
('Jay Alammar',                   'https://jalammar.github.io',                   'news', 'rss', 'active', 'blog',       'weekly',    4.50, 'Visual explainers for ML concepts'),
('Chip Huyen''s Blog',            'https://huyenchip.com',                        'news', 'rss', 'active', 'blog',       'weekly',    4.50, 'MLOps, LLMs, AI engineering'),
('MIT Technology Review -- AI',   'https://www.technologyreview.com/ai',          'news', 'rss', 'active', 'blog',       'every_12h', 4.00, 'Mainstream AI news coverage'),
('VentureBeat AI',                'https://venturebeat.com/ai',                   'news', 'rss', 'active', 'blog',       'every_12h', 3.50, 'AI industry news'),
('The Verge -- AI',               'https://www.theverge.com/ai-artificial-intelligence', 'news', 'rss', 'active', 'blog', 'every_12h', 3.50, 'Consumer AI news'),
('Ars Technica -- AI',            'https://arstechnica.com/ai',                   'news', 'rss', 'active', 'blog',       'every_12h', 4.00, 'Technical AI journalism'),
('TechCrunch -- AI',              'https://techcrunch.com/category/artificial-intelligence', 'news', 'rss', 'active', 'blog', 'every_12h', 3.50, 'AI startup and product news'),
('Latent Space Podcast',          'https://www.latent.space',                     'news', 'rss', 'active', 'newsletter', 'daily',     4.50, 'AI engineering podcast and newsletter');

-- COMPANIES & LABS
INSERT INTO sources (name, url, category, type, status, platform, fetch_frequency, reliability_score, notes) VALUES
('OpenAI Blog',                 'https://openai.com/news',                        'company', 'rss',   'active', 'blog',   'every_12h', 5.00, 'Official OpenAI announcements'),
('Anthropic Research',          'https://anthropic.com/research',                  'company', 'scrape','active', 'blog',   'every_12h', 5.00, 'Anthropic papers and updates'),
('Google DeepMind Blog',        'https://deepmind.google/discover/blog',           'company', 'scrape','active', 'blog',   'every_12h', 5.00, 'DeepMind research'),
('Meta AI Blog',                'https://ai.meta.com/blog',                        'company', 'scrape','active', 'blog',   'every_12h', 5.00, 'Meta AI research and releases'),
('Microsoft Research Blog',     'https://www.microsoft.com/en-us/research/blog',   'company', 'rss',   'active', 'blog',   'every_12h', 4.50, 'MS Research blog with RSS'),
('Mistral AI Blog',             'https://mistral.ai/news',                         'company', 'scrape','active', 'blog',   'every_12h', 4.50, 'Mistral announcements'),
('Cohere Blog',                 'https://cohere.com/blog',                         'company', 'scrape','active', 'blog',   'every_12h', 4.00, 'Cohere product and research'),
('Stability AI',                'https://stability.ai/news',                       'company', 'scrape','active', 'blog',   'every_12h', 4.00, 'Stability AI announcements'),
('NVIDIA AI Blog',              'https://blogs.nvidia.com/blog/category/deep-learning', 'company', 'rss', 'active', 'blog', 'every_12h', 4.50, 'Hardware, models, deep learning'),
('Apple Machine Learning',      'https://machinelearning.apple.com',               'company', 'rss',   'active', 'blog',   'weekly',    4.50, 'Apple ML research journal'),
('xAI',                         'https://x.ai',                                    'company', 'scrape','active', 'blog',   'weekly',    4.00, 'xAI announcements');

-- CONFERENCES & EVENTS
INSERT INTO sources (name, url, category, type, status, platform, fetch_frequency, reliability_score, notes) VALUES
('NeurIPS',           'https://neurips.cc',          'conference', 'scrape', 'active', 'other', 'weekly', 5.00, 'Top ML conference'),
('ICML',              'https://icml.cc',             'conference', 'scrape', 'active', 'other', 'weekly', 5.00, 'International Conference on ML'),
('ICLR',              'https://iclr.cc',             'conference', 'scrape', 'active', 'other', 'weekly', 5.00, 'International Conference on Learning Representations'),
('AAAI',              'https://aaai.org',            'conference', 'scrape', 'active', 'other', 'weekly', 4.50, 'Association for AI conference'),
('CVPR',              'https://cvpr.thecvf.com',     'conference', 'scrape', 'active', 'other', 'weekly', 4.50, 'Computer Vision conference'),
('ACL',               'https://aclweb.org',          'conference', 'scrape', 'active', 'other', 'weekly', 4.50, 'NLP conference'),
('EMNLP',             'https://emnlp.org',           'conference', 'scrape', 'active', 'other', 'weekly', 4.00, 'Empirical Methods in NLP'),
('AI Engineer Summit', 'https://ai.engineer',        'conference', 'scrape', 'active', 'other', 'weekly', 4.00, 'Applied AI engineering conference');

-- BENCHMARKS & LEADERBOARDS
INSERT INTO sources (name, url, category, type, status, platform, fetch_frequency, reliability_score, notes) VALUES
('LMSYS Chatbot Arena',        'https://lmarena.ai',                                       'benchmark', 'scrape', 'active', 'other',       'daily',     5.00, 'Community LLM rankings via blind voting'),
('Open LLM Leaderboard',       'https://huggingface.co/spaces/open-llm-leaderboard',       'benchmark', 'api',    'active', 'huggingface', 'daily',     4.50, 'HuggingFace-hosted benchmark leaderboard'),
('Artificial Analysis',        'https://artificialanalysis.ai',                             'benchmark', 'scrape', 'active', 'other',       'daily',     4.50, 'LLM price/performance comparisons');

-- PODCASTS & VIDEO
INSERT INTO sources (name, url, category, type, status, platform, fetch_frequency, reliability_score, notes) VALUES
('Lex Fridman Podcast',               'https://lexfridman.com/podcast',                        'podcast', 'rss',   'active', 'youtube',  'every_6h', 4.50, 'Long-form AI researcher interviews'),
('Machine Learning Street Talk',      'https://www.youtube.com/@MachineLearningStreetTalk',    'podcast', 'api',   'active', 'youtube',  'every_6h', 4.50, 'Technical ML discussions'),
('Yannic Kilcher',                    'https://www.youtube.com/@YannicKilcher',                'podcast', 'api',   'active', 'youtube',  'every_6h', 4.50, 'Paper reviews and ML commentary'),
('Two Minute Papers',                 'https://www.youtube.com/@TwoMinutePapers',              'podcast', 'api',   'active', 'youtube',  'every_6h', 4.00, 'Short AI paper summaries'),
('No Priors Podcast',                 'https://www.youtube.com/@NoPriorsPodcast',              'podcast', 'api',   'active', 'youtube',  'every_6h', 4.00, 'AI industry interviews');

-- SECONDARY SOURCES (X/LinkedIn coverage via aggregators)
INSERT INTO sources (name, url, category, type, status, platform, fetch_frequency, reliability_score, notes) VALUES
('ThreadReaderApp -- AI Threads',     'https://threadreaderapp.com/search?q=AI+machine+learning', 'social', 'scrape', 'active', 'x',          'every_6h', 3.50, 'Secondary source: unrolled AI Twitter threads'),
('Last Week in AI Newsletter',        'https://lastweekin.ai',                                    'news',   'rss',    'active', 'newsletter', 'weekly',    4.00, 'Secondary source: weekly AI news digest covering X and LinkedIn posts'),
('AI News Roundup (TLDR)',            'https://tldr.tech/ai',                                     'news',   'rss',    'active', 'newsletter', 'daily',     4.00, 'Secondary source: daily AI digest curating top X/LinkedIn/blog posts'),
('Davis Summarizes Papers',           'https://dblalock.substack.com',                            'news',   'rss',    'active', 'newsletter', 'weekly',    4.00, 'Secondary source: weekly paper summaries often referencing X discussions'),
('Interconnects (Nathan Lambert)',    'https://www.interconnects.ai',                              'news',   'rss',    'active', 'newsletter', 'weekly',    4.50, 'Secondary source: RLHF/alignment newsletter, references X discourse');
