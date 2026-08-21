(function (global) {
    'use strict';

    const loadedScripts = {};

    function loadScript(src) {
        if (loadedScripts[src]) {
            return loadedScripts[src];
        }

        loadedScripts[src] = new Promise(function (resolve, reject) {
            const existing = document.querySelector('script[src="' + src + '"]');
            if (existing) {
                if (existing.dataset.loaded === 'true') {
                    resolve();
                    return;
                }
                existing.addEventListener('load', function () { resolve(); }, { once: true });
                existing.addEventListener('error', function () { reject(new Error('Failed to load ' + src)); }, { once: true });
                return;
            }

            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.onload = function () {
                script.dataset.loaded = 'true';
                resolve();
            };
            script.onerror = function () {
                reject(new Error('Failed to load ' + src));
            };
            document.head.appendChild(script);
        });

        return loadedScripts[src];
    }

    let chartReady;
    function ensureChartJs() {
        chartReady = chartReady || loadScript('https://cdn.jsdelivr.net/npm/chart.js')
            .then(function () { return loadScript('https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2'); })
            .then(function () {
                if (global.Chart && global.ChartDataLabels) {
                    global.Chart.register(global.ChartDataLabels);
                }
            });
        return chartReady;
    }

    let wordcloudReady;
    function ensureWordCloud() {
        wordcloudReady = wordcloudReady || loadScript('https://cdn.jsdelivr.net/npm/wordcloud@1.2.2/src/wordcloud2.min.js');
        return wordcloudReady;
    }

    let html2pdfReady;
    function ensureHtml2Pdf() {
        html2pdfReady = html2pdfReady || loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js');
        return html2pdfReady;
    }

    let googleChartsReady;
    function ensureGoogleCharts() {
        googleChartsReady = googleChartsReady || loadScript('https://www.gstatic.com/charts/loader.js')
            .then(function () {
                return new Promise(function (resolve) {
                    global.google.charts.load('current', { packages: ['sankey'] });
                    global.google.charts.setOnLoadCallback(resolve);
                });
            });
        return googleChartsReady;
    }

    global.ReportLoaders = {
        loadScript: loadScript,
        ensureChartJs: ensureChartJs,
        ensureWordCloud: ensureWordCloud,
        ensureHtml2Pdf: ensureHtml2Pdf,
        ensureGoogleCharts: ensureGoogleCharts
    };
})(window);
