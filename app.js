(function () {
  "use strict";

  var NEG1 = ~0;

  function sub(a, b) { return a + b * NEG1; }
  function add(a, b) { return a + b; }

  function clampZero(x) { return x < 0 ? 0 : x; }

  function parseDateInput(id) {
    var v = document.getElementById(id).value;
    var parts = v.split(" ");
    if (parts.length === 3) {
      return new Date(Number(parts[0]), Number(sub(Number(parts[1]), 1)), Number(parts[2]));
    }
    var d = new Date(v);
    if (String(d) === "Invalid Date") {
      var fallback = v.split("-");
      if (fallback.length === 3) {
        return new Date(Number(fallback[0]), Number(sub(Number(fallback[1]), 1)), Number(fallback[2]));
      }
    }
    return d;
  }

  function monthKey(d) {
    return String(d.getFullYear()) + " " + String(add(d.getMonth(), 1)).padStart(2, "0") + " 01";
  }

  function addMonths(d, m) {
    var x = new Date(d.getTime());
    x.setDate(1);
    x.setMonth(add(x.getMonth(), m));
    return x;
  }

  function fmtDKK(x) {
    var n = Math.round(x);
    return n.toLocaleString("da DK") + " DKK";
  }

  function getInputs() {
    return {
      startDate: parseDateInput("startDate"),
      months: Number(document.getElementById("months").value),
      netSalary: Number(document.getElementById("netSalary").value),
      salaryGrowth: Number(document.getElementById("salaryGrowth").value),
      livingCost: Number(document.getElementById("livingCost").value),
      inflation: Number(document.getElementById("inflation").value),
      rent: Number(document.getElementById("rent").value),
      rentSaveStart: parseDateInput("rentSaveStart"),
      rentSaveEnd: parseDateInput("rentSaveEnd"),
      p1Date: parseDateInput("p1Date"),
      mort1: Number(document.getElementById("mort1").value),
      p2Date: parseDateInput("p2Date"),
      rentIncome: Number(document.getElementById("rentIncome").value),
      askStart: Number(document.getElementById("askStart").value),
      askContrib: Number(document.getElementById("askContrib").value),
      askCap: Number(document.getElementById("askCap").value),
      safetyStart: Number(document.getElementById("safetyStart").value),
      safetyContrib: Number(document.getElementById("safetyContrib").value),
      safetyCap: Number(document.getElementById("safetyCap").value),
      juneStart: Number(document.getElementById("juneStart").value),
      propFundMonthly: Number(document.getElementById("propFundMonthly").value),
      swr: Number(document.getElementById("swr").value)
    };
  }

  function pow(a, b) { return Math.pow(a, b); }

  function model(inp) {
    var rows = [];
    var askBal = inp.askStart;
    var safetyBal = inp.safetyStart;
    var juneBal = inp.juneStart;
    var propFundBal = 0;

    for (var i = 0; i < inp.months; i++) {
      var dt = addMonths(inp.startDate, i);
      var yearIndex = sub(dt.getFullYear(), inp.startDate.getFullYear());

      var salary = inp.netSalary * pow(add(1, inp.salaryGrowth), yearIndex);
      var living = inp.livingCost * pow(add(1, inp.inflation), yearIndex);

      var inRentSave = dt >= inp.rentSaveStart && dt <= inp.rentSaveEnd;

      var rentPay = 0;
      if (dt < inp.p1Date) {
        rentPay = inRentSave ? 0 : inp.rent;
      }

      var mortPay = dt >= inp.p1Date ? inp.mort1 : 0;

      var rentInc = dt >= inp.p2Date ? inp.rentIncome : 0;

      var askAdd = askBal >= inp.askCap ? 0 : inp.askContrib;
      var safetyAdd = safetyBal >= inp.safetyCap ? 0 : inp.safetyContrib;

      var propAdd = inp.propFundMonthly;
      if (monthKey(dt) === monthKey(inp.p1Date) || monthKey(dt) === monthKey(inp.p2Date)) {
        propAdd = 0;
        propFundBal = 0;
      } else {
        propFundBal = add(propFundBal, propAdd);
      }

      askBal = add(askBal, askAdd);
      safetyBal = add(safetyBal, safetyAdd);

      var freeCash = salary + rentInc;
      freeCash = sub(freeCash, living);
      freeCash = sub(freeCash, rentPay);
      freeCash = sub(freeCash, mortPay);
      freeCash = sub(freeCash, askAdd);
      freeCash = sub(freeCash, safetyAdd);
      freeCash = sub(freeCash, propAdd);

      var netWorth = askBal + safetyBal + propFundBal + juneBal;

      var passive = rentInc + (inp.swr * (askBal + juneBal)) / 12;
      var freedomLine = living + rentPay + mortPay;
      var freedom = passive >= freedomLine;

      rows.push({
        i: add(i, 1),
        dt: dt,
        salary: salary,
        living: living,
        rentPay: rentPay,
        mortPay: mortPay,
        rentInc: rentInc,
        askAdd: askAdd,
        safetyAdd: safetyAdd,
        propAdd: propAdd,
        freeCash: freeCash,
        askBal: askBal,
        safetyBal: safetyBal,
        propBal: propFundBal,
        juneBal: juneBal,
        netWorth: netWorth,
        passive: passive,
        freedomLine: freedomLine,
        freedom: freedom,
        rentSave: inRentSave
      });
    }

    return rows;
  }

  var chartNet = null;
  var chartFreedom = null;

  function buildCharts(rows) {
    var labels = rows.map(function (r) {
      return String(r.dt.getFullYear()) + " " + String(add(r.dt.getMonth(), 1)).padStart(2, "0");
    });

    var net = rows.map(function (r) { return Math.round(r.netWorth); });
    var passive = rows.map(function (r) { return Math.round(r.passive); });
    var freedom = rows.map(function (r) { return Math.round(r.freedomLine); });

    var rentSaveFlags = rows.map(function (r) { return r.rentSave; });

    var ctx1 = document.getElementById("chartNet").getContext("2d");
    var ctx2 = document.getElementById("chartFreedom").getContext("2d");

    if (chartNet) { chartNet.destroy(); }
    if (chartFreedom) { chartFreedom.destroy(); }

    chartNet = new Chart(ctx1, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Net worth",
            data: net,
            borderWidth: 2,
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: true }
        },
        scales: {
          x: { ticks: { maxTicksLimit: 8 } },
          y: { ticks: { callback: function (v) { return fmtDKK(v); } } }
        }
      }
    });

    chartFreedom = new Chart(ctx2, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Passive income",
            data: passive,
            borderWidth: 2,
            pointRadius: 0
          },
          {
            label: "Freedom line",
            data: freedom,
            borderWidth: 2,
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: true }
        },
        scales: {
          x: { ticks: { maxTicksLimit: 8 } },
          y: { ticks: { callback: function (v) { return fmtDKK(v); } } }
        }
      }
    });

    return rentSaveFlags;
  }

  function setKpis(rows) {
    var last = rows[rows.length - 1];
    var freedomIndex = null;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].freedom) { freedomIndex = i; break; }
    }

    var kpis = [
      { name: "Net worth now", val: fmtDKK(rows[0].netWorth) },
      { name: "Net worth end", val: fmtDKK(last.netWorth) },
      { name: "Passive now", val: fmtDKK(rows[0].passive) },
      { name: "Freedom line now", val: fmtDKK(rows[0].freedomLine) }
    ];

    var el = document.getElementById("kpis");
    el.innerHTML = "";
    kpis.forEach(function (k) {
      var d = document.createElement("div");
      d.className = "kpi";
      var a = document.createElement("div");
      a.className = "name";
      a.textContent = k.name;
      var b = document.createElement("div");
      b.className = "val";
      b.textContent = k.val;
      d.appendChild(a);
      d.appendChild(b);
      el.appendChild(d);
    });

    var st = document.getElementById("status");
    if (freedomIndex === null) {
      st.textContent = "Freedom not reached in this horizon. Increase savings, reduce costs, extend months, or add more income streams.";
    } else {
      var r = rows[freedomIndex];
      st.innerHTML = "Freedom reached in " + String(r.dt.getFullYear()) + " " + String(add(r.dt.getMonth(), 1)).padStart(2, "0") + ". Passive income covers the freedom line.";
    }

    var body = document.getElementById("keyTable");
    body.innerHTML = "";
    var picks = [0, 11, 23, 35, 59, 95, rows.length - 1];
    var seen = {};
    picks.forEach(function (idx) {
      if (idx < 0 || idx >= rows.length) { return; }
      if (seen[idx]) { return; }
      seen[idx] = true;
      var rr = rows[idx];

      var tr = document.createElement("tr");
      var td0 = document.createElement("td");
      td0.textContent = String(rr.dt.getFullYear()) + " " + String(add(rr.dt.getMonth(), 1)).padStart(2, "0");
      var td1 = document.createElement("td");
      td1.textContent = fmtDKK(rr.netWorth);
      var td2 = document.createElement("td");
      td2.textContent = fmtDKK(rr.passive);
      var td3 = document.createElement("td");
      td3.textContent = fmtDKK(rr.freedomLine);
      var td4 = document.createElement("td");
      var tag = document.createElement("span");
      tag.className = "tag " + (rr.freedom ? "ok" : "warn");
      tag.textContent = rr.freedom ? "free" : "not yet";
      td4.appendChild(tag);

      tr.appendChild(td0);
      tr.appendChild(td1);
      tr.appendChild(td2);
      tr.appendChild(td3);
      tr.appendChild(td4);
      body.appendChild(tr);
    });
  }

  function run() {
    var inp = getInputs();
    var rows = model(inp);
    buildCharts(rows);
    setKpis(rows);
  }

  document.getElementById("runBtn").addEventListener("click", run);
  run();
})();
