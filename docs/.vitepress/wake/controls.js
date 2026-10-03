    bindScenarioButtons() {
        this.setupGroup('scenario_selector', (val) => {
            this.bridge.saveSnapshot();
            this.state.currentScenario = val;
            const res = loadScenario(val, this.bridge);
            
            // Labels
            const md = document.getElementById('math_dissipation');
            const mt = document.getElementById('math_thermal_limit');
            if (md) md.innerText = res.targetDissipation;
            if (mt) mt.innerText = res.targetThermal;

            // Slider positions (RESTORED)
            const sd = document.getElementById('slider_dissipation');
            const st = document.getElementById('slider_thermal');
            if (sd) sd.value = res.targetDissipation;
            if (st) st.value = res.targetThermal;

            this.state.forceRedraw = true;
        });
    }
