what dies Backfill Historical Content do ? 
Backfill failed for period 1month: Command failed: PYTHONPATH="/Users/kunuruabhishek/Desktop/Time_pass/Claude_code/LLM_news_aggregator" "/Users/kunuruabhishek/Desktop/Time_pass/Claude_code/LLM_news_aggregator/ingestion/.venv/bin/python" -m ingestion.run --sources all --backfill 1month usage: run.py [-h] [--sources SOURCES] run.py: error: unrecognized arguments: --backfill 1month

why this error ? 


in limit in feed page , i chnaged it 50 still only 30 topics are being showed ?

also in 1 year i see most of the topics are from march and april ? Remove the existing data and  do a re -ingestion of the last one year data and 
re-compute the relative scores . 

also whenever we do a back fill , amke sure there will be no duplicates sources in the data base .