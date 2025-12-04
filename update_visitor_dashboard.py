#!/usr/bin/env python3
"""
Pendo Visitor Dashboard Generator
Fetches unique visitor data and generates an HTML dashboard.
Run daily via cron to keep data updated.
"""

import json
import subprocess
import time
from datetime import datetime, timedelta
from collections import defaultdict

API_KEY = "7d0eb12c-2c01-406a-9614-39a27227ca72.us"
ACCOUNT_ID = "20482_ciscospaces.app"
OUTPUT_FILE = "/Users/visbhatt/Documents/code/sample-app/visitor_dashboard.html"
DATA_FILE = "/Users/visbhatt/Documents/code/sample-app/visitor_history.json"

def fetch_aggregation(pipeline):
    payload = json.dumps({
        "response": {"mimeType": "application/json"},
        "request": {"pipeline": pipeline}
    })
    result = subprocess.run([
        'curl', '-s', '-X', 'POST',
        'https://app.pendo.io/api/v1/aggregation',
        '-H', f'x-pendo-integration-key: {API_KEY}',
        '-H', 'Content-Type: application/json',
        '-d', payload
    ], capture_output=True, text=True)
    try:
        return json.loads(result.stdout)
    except:
        return None

def get_daily_visitors(days_ago_start, days_ago_end):
    """Get unique visitors for a specific day range"""
    now = time.time()
    start_ts = int((now - days_ago_start * 24 * 60 * 60) * 1000)
    end_ts = int((now - days_ago_end * 24 * 60 * 60) * 1000)
    
    pipeline = [
        {
            "source": {
                "events": None,
                "timeSeries": {
                    "period": "dayRange",
                    "first": start_ts,
                    "last": end_ts
                }
            }
        },
        {"filter": f'accountId == "{ACCOUNT_ID}"'},
        {
            "group": {
                "group": ["visitorId"],
                "fields": [{"eventCount": {"count": None}}]
            }
        }
    ]
    
    data = fetch_aggregation(pipeline)
    if data and data.get('results'):
        return len(data['results']), data['results']
    return 0, []

def load_history():
    """Load historical data"""
    try:
        with open(DATA_FILE, 'r') as f:
            return json.load(f)
    except:
        return {"daily_counts": [], "last_updated": None}

def save_history(history):
    """Save historical data"""
    with open(DATA_FILE, 'w') as f:
        json.dump(history, f, indent=2)

def generate_html(daily_data, total_visitors, top_visitors):
    """Generate the HTML dashboard"""
    
    today = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    # Prepare chart data
    labels = [d['date'] for d in daily_data]
    values = [d['count'] for d in daily_data]
    
    html = f'''<!DOCTYPE html>
<html>
<head>
    <title>Unique Visitors Dashboard - Live Updates</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono&display=swap" rel="stylesheet">
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            font-family: 'Inter', sans-serif;
            background: linear-gradient(135deg, #1e1e2f 0%, #2d2d44 100%);
            min-height: 100vh;
            padding: 30px;
            color: #fff;
        }}
        .container {{ max-width: 1200px; margin: 0 auto; }}
        
        .header {{
            text-align: center;
            margin-bottom: 40px;
        }}
        .header h1 {{
            font-size: 2.5em;
            font-weight: 700;
            margin-bottom: 10px;
        }}
        .header h1 .highlight {{
            background: linear-gradient(90deg, #6366f1, #8b5cf6, #a855f7);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }}
        .last-updated {{
            background: rgba(99, 102, 241, 0.2);
            display: inline-block;
            padding: 8px 20px;
            border-radius: 20px;
            font-size: 0.85em;
            color: #a5b4fc;
            border: 1px solid rgba(99, 102, 241, 0.3);
        }}
        .last-updated .dot {{
            display: inline-block;
            width: 8px;
            height: 8px;
            background: #22c55e;
            border-radius: 50%;
            margin-right: 8px;
            animation: pulse 2s infinite;
        }}
        @keyframes pulse {{
            0%, 100% {{ opacity: 1; }}
            50% {{ opacity: 0.5; }}
        }}
        
        /* Main Stats Card */
        .main-stat {{
            background: linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%);
            border-radius: 25px;
            padding: 40px;
            text-align: center;
            margin-bottom: 30px;
            border: 1px solid rgba(99, 102, 241, 0.3);
        }}
        .main-stat .value {{
            font-size: 6em;
            font-weight: 700;
            background: linear-gradient(90deg, #6366f1, #a855f7);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            line-height: 1;
        }}
        .main-stat .label {{
            color: #a5b4fc;
            font-size: 1.1em;
            margin-top: 10px;
            text-transform: uppercase;
            letter-spacing: 2px;
        }}
        
        /* Charts Grid */
        .charts-grid {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 25px;
            margin-bottom: 30px;
        }}
        .chart-card {{
            background: rgba(255,255,255,0.03);
            border-radius: 20px;
            padding: 25px;
            border: 1px solid rgba(255,255,255,0.08);
        }}
        .chart-card h3 {{
            color: #fff;
            font-size: 1.1em;
            margin-bottom: 20px;
            text-align: center;
        }}
        .chart-wrapper {{
            height: 280px;
            position: relative;
        }}
        
        /* Daily Trend Table */
        .trend-table {{
            background: rgba(255,255,255,0.03);
            border-radius: 20px;
            padding: 25px;
            border: 1px solid rgba(255,255,255,0.08);
            margin-bottom: 30px;
        }}
        .trend-table h3 {{
            color: #fff;
            font-size: 1.1em;
            margin-bottom: 20px;
            text-align: center;
        }}
        .trend-table table {{
            width: 100%;
            border-collapse: collapse;
        }}
        .trend-table th, .trend-table td {{
            padding: 12px 15px;
            text-align: center;
        }}
        .trend-table th {{
            background: rgba(99, 102, 241, 0.2);
            color: #a5b4fc;
            font-weight: 500;
            font-size: 0.85em;
            text-transform: uppercase;
            letter-spacing: 1px;
        }}
        .trend-table td {{
            border-bottom: 1px solid rgba(255,255,255,0.05);
            color: #e0e0e0;
        }}
        .trend-table tr:last-child td {{
            border-bottom: none;
        }}
        .trend-table .count {{
            font-size: 1.3em;
            font-weight: 600;
            color: #8b5cf6;
        }}
        
        /* Summary Section */
        .summary {{
            background: rgba(255,255,255,0.03);
            border-radius: 20px;
            padding: 30px;
            border: 1px solid rgba(255,255,255,0.08);
        }}
        .summary h3 {{
            color: #fff;
            font-size: 1.2em;
            margin-bottom: 20px;
            text-align: center;
        }}
        .summary-grid {{
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
        }}
        .summary-item {{
            text-align: center;
            padding: 20px;
            background: rgba(99, 102, 241, 0.1);
            border-radius: 15px;
            border: 1px solid rgba(99, 102, 241, 0.2);
        }}
        .summary-item .value {{
            font-size: 2em;
            font-weight: 700;
            color: #a855f7;
        }}
        .summary-item .label {{
            color: #a5b4fc;
            font-size: 0.8em;
            margin-top: 5px;
        }}
        
        /* Top Visitors */
        .top-visitors {{
            margin-top: 25px;
            padding-top: 25px;
            border-top: 1px solid rgba(255,255,255,0.08);
        }}
        .top-visitors h4 {{
            color: #a5b4fc;
            font-size: 0.9em;
            margin-bottom: 15px;
            text-align: center;
        }}
        .visitors-list {{
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            justify-content: center;
        }}
        .visitor-tag {{
            background: rgba(139, 92, 246, 0.15);
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 0.8em;
            color: #c4b5fd;
            border: 1px solid rgba(139, 92, 246, 0.3);
        }}
        
        .footer {{
            text-align: center;
            margin-top: 30px;
            color: #666;
            font-size: 0.85em;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 <span class="highlight">Unique Visitors</span> Dashboard</h1>
            <p style="color: #888; margin: 10px 0;">Account: <span style="font-family: JetBrains Mono; color: #8b5cf6;">20482_ciscospaces.app</span></p>
            <div class="last-updated">
                <span class="dot"></span>
                Last Updated: {today}
            </div>
        </div>
        
        <div class="main-stat">
            <div class="value">{total_visitors}</div>
            <div class="label">Total Unique Visitors (Last 7 Days)</div>
        </div>
        
        <div class="charts-grid">
            <div class="chart-card">
                <h3>📈 Daily Visitor Trend</h3>
                <div class="chart-wrapper">
                    <canvas id="lineChart"></canvas>
                </div>
            </div>
            <div class="chart-card">
                <h3>🥧 Distribution by Day</h3>
                <div class="chart-wrapper">
                    <canvas id="pieChart"></canvas>
                </div>
            </div>
        </div>
        
        <div class="trend-table">
            <h3>📅 Last 7 Days Breakdown</h3>
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Day</th>
                        <th>Unique Visitors</th>
                        <th>Trend</th>
                    </tr>
                </thead>
                <tbody>'''
    
    # Add table rows
    for i, d in enumerate(daily_data):
        trend = ""
        if i > 0:
            diff = d['count'] - daily_data[i-1]['count']
            if diff > 0:
                trend = f'<span style="color: #22c55e;">↑ +{diff}</span>'
            elif diff < 0:
                trend = f'<span style="color: #ef4444;">↓ {diff}</span>'
            else:
                trend = '<span style="color: #888;">→ 0</span>'
        else:
            trend = '<span style="color: #888;">—</span>'
        
        html += f'''
                    <tr>
                        <td>{d['date']}</td>
                        <td>{d['day']}</td>
                        <td class="count">{d['count']}</td>
                        <td>{trend}</td>
                    </tr>'''
    
    # Calculate summary stats
    avg_visitors = sum(values) / len(values) if values else 0
    max_visitors = max(values) if values else 0
    min_visitors = min(values) if values else 0
    max_day = labels[values.index(max_visitors)] if values else "N/A"
    
    html += f'''
                </tbody>
            </table>
        </div>
        
        <div class="summary">
            <h3>📋 Summary Statistics</h3>
            <div class="summary-grid">
                <div class="summary-item">
                    <div class="value">{total_visitors}</div>
                    <div class="label">Total Unique (7 Days)</div>
                </div>
                <div class="summary-item">
                    <div class="value">{round(avg_visitors, 1)}</div>
                    <div class="label">Daily Average</div>
                </div>
                <div class="summary-item">
                    <div class="value">{max_visitors}</div>
                    <div class="label">Peak Day</div>
                </div>
                <div class="summary-item">
                    <div class="value">{min_visitors}</div>
                    <div class="label">Lowest Day</div>
                </div>
            </div>
            
            <div class="top-visitors">
                <h4>🏆 Top Active Visitors</h4>
                <div class="visitors-list">'''
    
    for v in top_visitors[:12]:
        name = v['visitorId'].split('_')[0] if '_' in v['visitorId'] else v['visitorId']
        html += f'''
                    <span class="visitor-tag">{name}</span>'''
    
    html += f'''
                </div>
            </div>
        </div>
        
        <div class="footer">
            Auto-updated daily • Data from Pendo Analytics
        </div>
    </div>
    
    <script>
        // Line Chart
        new Chart(document.getElementById('lineChart').getContext('2d'), {{
            type: 'line',
            data: {{
                labels: {json.dumps(labels)},
                datasets: [{{
                    label: 'Unique Visitors',
                    data: {json.dumps(values)},
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#8b5cf6',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 5
                }}]
            }},
            options: {{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {{
                    legend: {{ display: false }}
                }},
                scales: {{
                    y: {{
                        beginAtZero: true,
                        grid: {{ color: 'rgba(255,255,255,0.05)' }},
                        ticks: {{ color: '#888' }}
                    }},
                    x: {{
                        grid: {{ display: false }},
                        ticks: {{ color: '#888' }}
                    }}
                }}
            }}
        }});
        
        // Pie Chart
        new Chart(document.getElementById('pieChart').getContext('2d'), {{
            type: 'doughnut',
            data: {{
                labels: {json.dumps(labels)},
                datasets: [{{
                    data: {json.dumps(values)},
                    backgroundColor: [
                        '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
                        '#ec4899', '#f43f5e', '#f97316'
                    ],
                    borderColor: '#1e1e2f',
                    borderWidth: 3
                }}]
            }},
            options: {{
                responsive: true,
                maintainAspectRatio: false,
                cutout: '55%',
                plugins: {{
                    legend: {{
                        position: 'right',
                        labels: {{
                            color: '#888',
                            padding: 10,
                            font: {{ size: 11 }}
                        }}
                    }}
                }}
            }}
        }});
    </script>
</body>
</html>'''
    
    return html

def main():
    print("=" * 60)
    print("  PENDO VISITOR DASHBOARD GENERATOR")
    print(f"  Running at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    print()
    
    # Fetch data for each of the last 7 days
    daily_data = []
    all_visitors = set()
    top_visitors = []
    
    for i in range(7, 0, -1):
        date = (datetime.now() - timedelta(days=i)).strftime('%Y-%m-%d')
        day_name = (datetime.now() - timedelta(days=i)).strftime('%A')
        count, visitors = get_daily_visitors(i, i-1)
        
        daily_data.append({
            'date': date,
            'day': day_name[:3],
            'count': count
        })
        
        for v in visitors:
            all_visitors.add(v['visitorId'])
        
        print(f"  {date} ({day_name[:3]}): {count} visitors")
    
    # Get total unique visitors for last 7 days
    total_count, all_visitor_data = get_daily_visitors(7, 0)
    top_visitors = sorted(all_visitor_data, key=lambda x: x['eventCount'], reverse=True)
    
    print()
    print(f"  Total Unique Visitors (7 days): {total_count}")
    print()
    
    # Generate HTML
    html = generate_html(daily_data, total_count, top_visitors)
    
    with open(OUTPUT_FILE, 'w') as f:
        f.write(html)
    
    print(f"✅ Dashboard saved to: {OUTPUT_FILE}")
    print()
    
    # Save history
    history = load_history()
    history['daily_counts'] = daily_data
    history['last_updated'] = datetime.now().isoformat()
    history['total_visitors'] = total_count
    save_history(history)
    
    print(f"✅ History saved to: {DATA_FILE}")

if __name__ == "__main__":
    main()
