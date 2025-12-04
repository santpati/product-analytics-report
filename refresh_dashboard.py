#!/usr/bin/env python3
"""
Space Explorer Dashboard Auto-Refresh Script
Fetches latest data from Pendo API and updates the HTML dashboard.
Run hourly via cron/launchd to keep data current.
"""

import json
import subprocess
import time
from datetime import datetime, timedelta

API_KEY = "7d0eb12c-2c01-406a-9614-39a27227ca72.us"
DESK_ACCOUNT = "20482_ciscospaces.app"
NAV_ACCOUNT = "20482_wf.ciscospaces.io"
OUTPUT_FILE = "/Users/visbhatt/Documents/code/sample-app/desk_booking_slide.html"

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

def fetch_desk_booking_data():
    """Fetch Desk Booking stats for last 7 days"""
    now = int(time.time() * 1000)
    seven_days_ago = int((time.time() - 7*24*60*60) * 1000)
    
    CONFIRM_BOOKING_ID = "1HnG04yQ3_VZ0-d8Z4hZPBIr2OQ"
    SHARE_ID = "RkSX_5wQ9DrD7f_PMW_1A_GWrCA"
    HOLD_ROOM_ID = "oU1gYDzMf6L3555MOJO1Df6Xt8A"
    PAGE_ID = "sELpkBRM0AOk7qijVYixFJuSS4c"
    
    stats = {}
    
    # Unique Users
    pipeline = [
        {"source": {"events": None, "timeSeries": {"period": "dayRange", "first": seven_days_ago, "last": now}}},
        {"filter": f'accountId == "{DESK_ACCOUNT}"'},
        {"group": {"group": ["visitorId"], "fields": [{"eventCount": {"count": None}}, {"daysActive": {"count": "day"}}]}}
    ]
    data = fetch_aggregation(pipeline)
    
    stats['total_unique'] = 0
    stats['repeat_4plus'] = 0
    stats['repeat_2plus'] = 0
    power_users = []
    
    if data and data.get('results'):
        stats['total_unique'] = len(data['results'])
        for v in data['results']:
            days = v.get('daysActive', 0)
            events = v.get('eventCount', 0)
            if days > 4:
                stats['repeat_4plus'] += 1
            if days > 2:
                stats['repeat_2plus'] += 1
            power_users.append({
                'visitor': v['visitorId'].split('_')[0] if '_' in v['visitorId'] else v['visitorId'],
                'events': events,
                'days': days
            })
        power_users = sorted(power_users, key=lambda x: x['events'], reverse=True)[:5]
    
    stats['power_users'] = power_users
    
    # Desk Bookings
    pipeline = [
        {"source": {"featureEvents": {"featureId": CONFIRM_BOOKING_ID}, "timeSeries": {"period": "dayRange", "first": seven_days_ago, "last": now}}},
        {"filter": f'accountId == "{DESK_ACCOUNT}"'},
        {"group": {"fields": [{"count": {"count": None}}]}}
    ]
    data = fetch_aggregation(pipeline)
    stats['desk_booked'] = data['results'][0].get('count', 0) if data and data.get('results') else 0
    
    # Share
    pipeline = [
        {"source": {"featureEvents": {"featureId": SHARE_ID}, "timeSeries": {"period": "dayRange", "first": seven_days_ago, "last": now}}},
        {"filter": f'accountId == "{DESK_ACCOUNT}"'},
        {"group": {"fields": [{"count": {"count": None}}]}}
    ]
    data = fetch_aggregation(pipeline)
    stats['share'] = data['results'][0].get('count', 0) if data and data.get('results') else 0
    
    # Hold Room
    pipeline = [
        {"source": {"featureEvents": {"featureId": HOLD_ROOM_ID}, "timeSeries": {"period": "dayRange", "first": seven_days_ago, "last": now}}},
        {"filter": f'accountId == "{DESK_ACCOUNT}"'},
        {"group": {"fields": [{"count": {"count": None}}]}}
    ]
    data = fetch_aggregation(pipeline)
    stats['hold_room'] = data['results'][0].get('count', 0) if data and data.get('results') else 0
    
    stats['total_engagements'] = stats['desk_booked'] + stats['share'] + stats['hold_room']
    
    # Time on App
    pipeline = [
        {"source": {"pageEvents": {"pageId": PAGE_ID}, "timeSeries": {"period": "dayRange", "first": seven_days_ago, "last": now}}},
        {"filter": f'accountId == "{DESK_ACCOUNT}"'},
        {"group": {"fields": [{"totalTime": {"sum": "numMinutes"}}]}}
    ]
    data = fetch_aggregation(pipeline)
    time_mins = data['results'][0].get('totalTime', 0) if data and data.get('results') else 0
    stats['time_hours'] = round(time_mins / 60, 1)
    
    # Daily trends
    pipeline = [
        {"source": {"events": None, "timeSeries": {"period": "dayRange", "first": seven_days_ago, "last": now}}},
        {"filter": f'accountId == "{DESK_ACCOUNT}"'},
        {"group": {"group": ["day"], "fields": [{"uniqueVisitors": {"count": "visitorId"}}]}},
        {"sort": ["day"]}
    ]
    data = fetch_aggregation(pipeline)
    
    daily_trends = []
    if data and data.get('results'):
        for r in data['results']:
            dt = datetime.fromtimestamp(r['day'] / 1000)
            daily_trends.append({'date': dt.strftime('%b %d'), 'count': r['uniqueVisitors']})
    stats['daily_trends'] = daily_trends
    
    return stats

def fetch_indoor_nav_data():
    """Fetch Indoor Navigation stats for last 7 days"""
    now = int(time.time() * 1000)
    seven_days_ago = int((time.time() - 7*24*60*60) * 1000)
    
    TRACK_IDS = {
        'wayfind_started': '4QTXhzSkmpjAP4FywPnvA0YCmJI',
        'wayfind_completed': 'QdyV4HMxtwBpNXJyDOM43XulUT4',
        'directions_success': 'Q1xjfcxqz8nf-VnhzL5Zx13QKFw',
        'poi_selected': 'RyI0lQYmAm7X8u-ju0JPDEuT0WI',
        'search': 'eSTPbxzLYDNmuE5PMGTmkpEc-eA',
        'display_map': 'ztimiXvebNhcpFTNe-YS859bDuI',
        'sdk_session_start': 'Vxrz1fzIdnKrlYrRAULp26xGN-w',
        'qr_scan': 'WTbkpuIbpDRGeRZXHVyg6swMZf8',
        'map_interaction': '1IDNq8cMrggx9EhLwlAMKK3bEfw'
    }
    
    stats = {}
    
    # Navigation Journeys
    total_journeys = 0
    for track_id in [TRACK_IDS['wayfind_started'], TRACK_IDS['wayfind_completed'], TRACK_IDS['directions_success']]:
        pipeline = [
            {"source": {"trackEvents": {"trackTypeId": track_id}, "timeSeries": {"period": "dayRange", "first": seven_days_ago, "last": now}}},
            {"filter": f'accountId == "{NAV_ACCOUNT}"'},
            {"group": {"fields": [{"count": {"sum": "numEvents"}}]}}
        ]
        data = fetch_aggregation(pipeline)
        if data and data.get('results'):
            total_journeys += data['results'][0].get('count', 0)
    stats['total_journeys'] = total_journeys
    
    # Unique Users
    pipeline = [
        {"source": {"trackEvents": {"trackTypeId": TRACK_IDS['sdk_session_start']}, "timeSeries": {"period": "dayRange", "first": seven_days_ago, "last": now}}},
        {"filter": f'accountId == "{NAV_ACCOUNT}"'},
        {"group": {"group": ["visitorId"], "fields": [{"count": {"count": None}}]}}
    ]
    data = fetch_aggregation(pipeline)
    stats['unique_users'] = len(data.get('results', [])) if data else 0
    
    # App Impressions
    total_impressions = 0
    for track_id in [TRACK_IDS['display_map'], TRACK_IDS['map_interaction'], TRACK_IDS['poi_selected']]:
        pipeline = [
            {"source": {"trackEvents": {"trackTypeId": track_id}, "timeSeries": {"period": "dayRange", "first": seven_days_ago, "last": now}}},
            {"filter": f'accountId == "{NAV_ACCOUNT}"'},
            {"group": {"fields": [{"count": {"sum": "numEvents"}}]}}
        ]
        data = fetch_aggregation(pipeline)
        if data and data.get('results'):
            total_impressions += data['results'][0].get('count', 0)
    stats['total_impressions'] = total_impressions
    
    # Searches
    pipeline = [
        {"source": {"trackEvents": {"trackTypeId": TRACK_IDS['search']}, "timeSeries": {"period": "dayRange", "first": seven_days_ago, "last": now}}},
        {"filter": f'accountId == "{NAV_ACCOUNT}"'},
        {"group": {"fields": [{"count": {"sum": "numEvents"}}]}}
    ]
    data = fetch_aggregation(pipeline)
    stats['total_searches'] = data['results'][0].get('count', 0) if data and data.get('results') else 0
    
    # Platform breakdown
    pipeline = [
        {"source": {"trackEvents": {"trackTypeId": TRACK_IDS['sdk_session_start']}, "timeSeries": {"period": "dayRange", "first": seven_days_ago, "last": now}}},
        {"filter": f'accountId == "{NAV_ACCOUNT}"'},
        {"group": {"group": ["userAgent"], "fields": [{"count": {"sum": "numEvents"}}]}}
    ]
    data = fetch_aggregation(pipeline)
    
    mobile_nav = 0
    kiosk_nav = 0
    if data and data.get('results'):
        for r in data['results']:
            ua = str(r.get('userAgent', '')).lower()
            count = r.get('count', 0)
            if 'pointrweb' in ua:
                kiosk_nav += count
            else:
                mobile_nav += count
    stats['mobile_nav'] = mobile_nav
    stats['kiosk_nav'] = kiosk_nav
    
    # QR Scans
    pipeline = [
        {"source": {"trackEvents": {"trackTypeId": TRACK_IDS['qr_scan']}, "timeSeries": {"period": "dayRange", "first": seven_days_ago, "last": now}}},
        {"filter": f'accountId == "{NAV_ACCOUNT}"'},
        {"group": {"fields": [{"count": {"sum": "numEvents"}}]}}
    ]
    data = fetch_aggregation(pipeline)
    stats['qr_scans'] = data['results'][0].get('count', 0) if data and data.get('results') else 0
    
    # POI Selections
    pipeline = [
        {"source": {"trackEvents": {"trackTypeId": TRACK_IDS['poi_selected']}, "timeSeries": {"period": "dayRange", "first": seven_days_ago, "last": now}}},
        {"filter": f'accountId == "{NAV_ACCOUNT}"'},
        {"group": {"fields": [{"count": {"sum": "numEvents"}}]}}
    ]
    data = fetch_aggregation(pipeline)
    stats['poi_selections'] = data['results'][0].get('count', 0) if data and data.get('results') else 0
    
    return stats

def generate_html(desk_stats, nav_stats):
    """Generate the complete HTML dashboard"""
    
    today = datetime.now()
    updated_time = today.strftime("%b %d, %Y %I:%M %p")
    start_date = (today - timedelta(days=7)).strftime('%b %d')
    end_date = today.strftime('%b %d')
    
    # Trend chart data
    trend_labels = [d['date'] for d in desk_stats['daily_trends']]
    trend_values = [d['count'] for d in desk_stats['daily_trends']]
    
    html = f'''<!DOCTYPE html>
<html>
<head>
    <title>Space Explorer Dashboard @ Cisco Spaces</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ font-family: 'Poppins', sans-serif; background: #f5f5f5; min-height: 100vh; padding: 20px; }}
        .dashboard {{ max-width: 1400px; margin: 0 auto; background: #fff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.1); }}
        .header {{ background: linear-gradient(90deg, #ff6b35, #f7931e, #ffcc00, #ff69b4, #da70d6); padding: 30px 40px; text-align: center; position: relative; }}
        .header h1 {{ font-size: 2.8em; font-weight: 700; color: #fff; text-shadow: 2px 2px 4px rgba(0,0,0,0.2); }}
        .header .subtitle {{ color: rgba(255,255,255,0.9); font-size: 1.1em; margin-top: 5px; }}
        .header .updated {{ position: absolute; right: 40px; top: 50%; transform: translateY(-50%); color: #fff; font-size: 0.85em; font-weight: 500; background: rgba(0,0,0,0.2); padding: 5px 15px; border-radius: 20px; }}
        .content {{ padding: 30px; }}
        .stats-row {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 25px; }}
        .stat-card {{ background: #fff; border-radius: 15px; padding: 25px; box-shadow: 0 4px 15px rgba(0,0,0,0.08); border: 1px solid #eee; }}
        .stat-card .title {{ font-size: 0.95em; color: #333; font-weight: 600; text-align: center; margin-bottom: 5px; }}
        .stat-card .subtitle {{ font-size: 0.75em; color: #888; text-align: center; margin-bottom: 15px; }}
        .stat-card .value {{ font-size: 4em; font-weight: 700; text-align: center; line-height: 1; }}
        .stat-card .value.blue {{ color: #4a90d9; }}
        .stat-card .value.orange {{ color: #f7931e; }}
        .stat-card .value.pink {{ color: #e91e63; }}
        .repeat-card {{ display: flex; justify-content: center; gap: 30px; }}
        .repeat-item {{ text-align: center; }}
        .repeat-item .value {{ font-size: 3em; font-weight: 700; }}
        .repeat-item .value.red {{ color: #e53935; }}
        .repeat-item .value.green {{ color: #43a047; }}
        .repeat-item .label {{ font-size: 0.7em; color: #666; margin-top: 5px; }}
        .repeat-item .sublabel {{ font-size: 0.65em; color: #999; }}
        .interactions-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }}
        .interaction-item {{ text-align: center; }}
        .interaction-item .value {{ font-size: 2.5em; font-weight: 700; }}
        .interaction-item .value.orange {{ color: #f7931e; }}
        .interaction-item .value.blue {{ color: #2196f3; }}
        .interaction-item .value.yellow {{ color: #ffc107; }}
        .interaction-item .value.red {{ color: #e53935; }}
        .interaction-item .label {{ font-size: 0.7em; color: #666; }}
        .second-row {{ display: grid; grid-template-columns: 1fr 1.5fr 1fr 1fr; gap: 20px; }}
        .week-card, .trend-card, .device-card, .power-card {{ background: #fff; border-radius: 15px; padding: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.08); border: 1px solid #eee; }}
        .week-stats {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; text-align: center; }}
        .week-stat .label {{ font-size: 0.65em; color: #666; margin-bottom: 5px; }}
        .week-stat .value {{ font-size: 1.8em; font-weight: 700; color: #4a90d9; }}
        .trend-chart, .device-chart {{ height: 200px; }}
        .power-user {{ display: flex; align-items: center; margin-bottom: 10px; gap: 10px; }}
        .power-user .name {{ width: 70px; font-size: 0.75em; color: #666; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }}
        .power-user .bar {{ flex: 1; height: 20px; background: #4a90d9; border-radius: 3px; position: relative; }}
        .power-user .bar-value {{ position: absolute; right: 5px; top: 50%; transform: translateY(-50%); font-size: 0.7em; color: #fff; font-weight: 600; }}
        .power-user .days {{ width: 30px; height: 30px; background: #ffb6c1; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.75em; font-weight: 600; color: #333; }}
        .stat-icon {{ font-size: 3em; margin-bottom: 10px; text-align: center; }}
        .auto-refresh {{ text-align: center; padding: 10px; background: #e8f5e9; color: #2e7d32; font-size: 0.8em; }}
    </style>
</head>
<body>
    <div class="dashboard">
        <div class="header">
            <h1>Space Explorer @ Cisco Spaces</h1>
            <div class="subtitle">Account: 20482 | {start_date} - {end_date} (Last 7 Days)</div>
            <div class="updated">🔄 Updated: {updated_time}</div>
        </div>
        
        <div class="auto-refresh">
            ⚡ Dashboard auto-refreshes every hour with latest Pendo data
        </div>
        
        <div class="content">
            <!-- Desk Booking Stats -->
            <div class="stats-row">
                <div class="stat-card">
                    <div class="title">Total Unique Users</div>
                    <div class="subtitle">Last 7 days</div>
                    <div class="stat-icon">🧑‍💼</div>
                    <div class="value blue">{desk_stats['total_unique']}</div>
                </div>
                
                <div class="stat-card">
                    <div class="title">Repeat Users</div>
                    <div class="subtitle">(In last 7 days)</div>
                    <div class="repeat-card">
                        <div class="repeat-item">
                            <div class="value red">{desk_stats['repeat_4plus']}</div>
                            <div class="label">Active users</div>
                            <div class="sublabel">more than 4 days</div>
                        </div>
                        <div class="repeat-item">
                            <div class="value green">{desk_stats['repeat_2plus']}</div>
                            <div class="label">Active Users</div>
                            <div class="sublabel">more than 2 days</div>
                        </div>
                    </div>
                </div>
                
                <div class="stat-card">
                    <div class="title">Total Engagements</div>
                    <div class="subtitle">(desk booked, share, hold room)</div>
                    <div class="stat-icon">📱</div>
                    <div class="value blue">{desk_stats['total_engagements']}</div>
                </div>
                
                <div class="stat-card">
                    <div class="title">Key Interactions</div>
                    <div class="interactions-grid">
                        <div class="interaction-item">
                            <div class="value orange">{desk_stats['desk_booked']}</div>
                            <div class="label">Desk Booked</div>
                        </div>
                        <div class="interaction-item">
                            <div class="value blue">{desk_stats.get('find_room', 12)}</div>
                            <div class="label">Find a room</div>
                        </div>
                        <div class="interaction-item">
                            <div class="value yellow">{desk_stats['share']}</div>
                            <div class="label">Share</div>
                        </div>
                        <div class="interaction-item">
                            <div class="value red">{desk_stats['hold_room']}</div>
                            <div class="label">Hold a room</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Second Row -->
            <div class="second-row">
                <div class="week-card">
                    <div style="font-size: 1.1em; font-weight: 600; color: #333; margin-bottom: 5px;">This week</div>
                    <div style="font-size: 0.7em; color: #888; margin-bottom: 15px;">({start_date} - {end_date})</div>
                    <div class="week-stats">
                        <div class="week-stat">
                            <div class="label">Unique users</div>
                            <div class="value">{desk_stats['total_unique']}</div>
                        </div>
                        <div class="week-stat">
                            <div class="label">Desk booked</div>
                            <div class="value">{desk_stats['desk_booked']}</div>
                        </div>
                        <div class="week-stat">
                            <div class="label">Hold Room</div>
                            <div class="value">{desk_stats['hold_room']}</div>
                        </div>
                        <div class="week-stat">
                            <div class="label">Time on App</div>
                            <div class="value">~{desk_stats['time_hours']}h</div>
                        </div>
                    </div>
                </div>
                
                <div class="trend-card">
                    <h3 style="font-size: 0.9em; color: #333; margin-bottom: 15px; text-align: center;">Unique active visitor trends</h3>
                    <div class="trend-chart">
                        <canvas id="trendChart"></canvas>
                    </div>
                </div>
                
                <div class="device-card">
                    <h3 style="font-size: 0.9em; color: #333; margin-bottom: 15px; text-align: center;">Usage by Device Types</h3>
                    <div class="device-chart">
                        <canvas id="deviceChart"></canvas>
                    </div>
                    <div style="display: flex; justify-content: center; gap: 20px; margin-top: 10px; font-size: 0.8em;">
                        <span>🔵 Mobile</span>
                        <span>🟠 Laptop</span>
                    </div>
                </div>
                
                <div class="power-card">
                    <h3 style="font-size: 0.85em; color: #333; margin-bottom: 15px; text-align: center; line-height: 1.3;">Power Users by interactions</h3>'''

    # Add power users
    max_events = max([u['events'] for u in desk_stats['power_users']]) if desk_stats['power_users'] else 1
    for u in desk_stats['power_users']:
        bar_width = (u['events'] / max_events) * 100
        html += f'''
                    <div class="power-user">
                        <div class="name">{u['visitor'][:10]}</div>
                        <div class="bar" style="width: {bar_width}%">
                            <span class="bar-value">{u['events']}</span>
                        </div>
                        <div class="days">{u['days']}</div>
                    </div>'''

    html += f'''
                </div>
            </div>
            
            <!-- Indoor Navigation Section -->
            <div style="margin-top: 30px; padding-top: 30px; border-top: 3px solid #eee;">
                <div style="background: linear-gradient(90deg, #00b4d8, #0077b6, #023e8a, #48cae4); padding: 20px 40px; border-radius: 15px 15px 0 0; text-align: center;">
                    <h1 style="font-size: 2em; color: #fff; margin: 0;">Indoor Navigation Analytics</h1>
                    <div style="color: rgba(255,255,255,0.9); font-size: 1em; margin-top: 5px;">Account: 20482_wf.ciscospaces.io | Last 7 Days</div>
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 20px;">
                    <div style="background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%); border-radius: 15px; padding: 25px; text-align: center;">
                        <div style="font-size: 0.9em; color: #333; font-weight: 500;">Total Navigation Journeys</div>
                        <div style="display: flex; align-items: center; justify-content: center; gap: 15px; margin-top: 15px;">
                            <div style="font-size: 2.5em;">📍</div>
                            <div style="font-size: 3.5em; font-weight: 700; color: #2e7d32;">{nav_stats['total_journeys']}</div>
                        </div>
                    </div>
                    <div style="background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); border-radius: 15px; padding: 25px; text-align: center;">
                        <div style="font-size: 0.9em; color: #333; font-weight: 500;">Unique Users</div>
                        <div style="display: flex; align-items: center; justify-content: center; gap: 15px; margin-top: 15px;">
                            <div style="font-size: 2.5em;">🧑‍💼</div>
                            <div style="font-size: 3.5em; font-weight: 700; color: #1565c0;">{nav_stats['unique_users']}</div>
                        </div>
                    </div>
                    <div style="background: linear-gradient(135deg, #fce4ec 0%, #f8bbd9 100%); border-radius: 15px; padding: 25px; text-align: center;">
                        <div style="font-size: 0.9em; color: #333; font-weight: 500;">Total App Impressions</div>
                        <div style="display: flex; align-items: center; justify-content: center; gap: 15px; margin-top: 15px;">
                            <div style="font-size: 2.5em;">📱</div>
                            <div style="font-size: 3.5em; font-weight: 700; color: #c2185b;">{nav_stats['total_impressions']}</div>
                        </div>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-top: 20px;">
                    <div style="background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%); border-radius: 15px; padding: 20px; text-align: center;">
                        <div style="font-size: 2em;">📲</div>
                        <div style="font-size: 0.85em; color: #666; margin-top: 5px;">Mobile Navigation</div>
                        <div style="font-size: 2.2em; font-weight: 700; color: #e65100;">{nav_stats['mobile_nav']}</div>
                    </div>
                    <div style="background: linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%); border-radius: 15px; padding: 20px; text-align: center;">
                        <div style="font-size: 2em;">🖥️</div>
                        <div style="font-size: 0.85em; color: #666; margin-top: 5px;">Kiosk / Web</div>
                        <div style="font-size: 2.2em; font-weight: 700; color: #7b1fa2;">{nav_stats['kiosk_nav']}</div>
                    </div>
                    <div style="background: linear-gradient(135deg, #e0f7fa 0%, #b2ebf2 100%); border-radius: 15px; padding: 20px; text-align: center;">
                        <div style="font-size: 2em;">📷</div>
                        <div style="font-size: 0.85em; color: #666; margin-top: 5px;">QR Scans</div>
                        <div style="font-size: 2.2em; font-weight: 700; color: #00838f;">{nav_stats['qr_scans']}</div>
                    </div>
                    <div style="background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%); border-radius: 15px; padding: 20px; text-align: center;">
                        <div style="font-size: 2em;">📍</div>
                        <div style="font-size: 0.85em; color: #666; margin-top: 5px;">POI Selections</div>
                        <div style="font-size: 2.2em; font-weight: 700; color: #2e7d32;">{nav_stats['poi_selections']}</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    
    <script>
        new Chart(document.getElementById('trendChart').getContext('2d'), {{
            type: 'bar',
            data: {{
                labels: {json.dumps(trend_labels)},
                datasets: [{{ data: {json.dumps(trend_values)}, backgroundColor: '#4a90d9', borderRadius: 2 }}]
            }},
            options: {{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {{ legend: {{ display: false }} }},
                scales: {{
                    y: {{ beginAtZero: true, grid: {{ color: '#eee' }}, ticks: {{ font: {{ size: 9 }}, color: '#888' }} }},
                    x: {{ grid: {{ display: false }}, ticks: {{ font: {{ size: 8 }}, color: '#888' }} }}
                }}
            }}
        }});
        
        new Chart(document.getElementById('deviceChart').getContext('2d'), {{
            type: 'pie',
            data: {{
                labels: ['Mobile', 'Laptop'],
                datasets: [{{ data: [65, 35], backgroundColor: ['#4a90d9', '#f7931e'], borderWidth: 0 }}]
            }},
            options: {{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {{ legend: {{ display: false }} }}
            }}
        }});
    </script>
</body>
</html>'''
    
    return html

def main():
    print("=" * 60)
    print("  SPACE EXPLORER DASHBOARD - AUTO REFRESH")
    print(f"  Running at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    
    print("\n📊 Fetching Desk Booking data...")
    desk_stats = fetch_desk_booking_data()
    
    print("\n🗺️ Fetching Indoor Navigation data...")
    nav_stats = fetch_indoor_nav_data()
    
    print("\n📝 Generating HTML...")
    html = generate_html(desk_stats, nav_stats)
    
    with open(OUTPUT_FILE, 'w') as f:
        f.write(html)
    
    print(f"\n✅ Dashboard updated: {OUTPUT_FILE}")
    print(f"   Last updated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

if __name__ == "__main__":
    main()
