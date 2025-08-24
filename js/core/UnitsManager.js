export class UnitsManager {
    constructor() {
        this.currentUnit = 'mm';
        this.units = {
            // Metric units (base is mm)
            'mm': { name: 'Millimeters', symbol: 'mm', factor: 1.0, decimal: 1 },
            'cm': { name: 'Centimeters', symbol: 'cm', factor: 10.0, decimal: 2 },
            'm': { name: 'Meters', symbol: 'm', factor: 1000.0, decimal: 3 },
            
            // Imperial units
            'in': { name: 'Inches', symbol: '"', factor: 25.4, decimal: 3 },
            'ft': { name: 'Feet', symbol: '\'', factor: 304.8, decimal: 3 },
            
            // Fractional inches
            'in_frac': { name: 'Fractional Inches', symbol: '"', factor: 25.4, decimal: 0, fractional: true }
        };
        
        this.updateUI();
    }

    setUnit(unit) {
        if (this.units[unit]) {
            this.currentUnit = unit;
            this.updateUI();
            this.dispatchUnitChangeEvent();
            return true;
        }
        return false;
    }

    getCurrentUnit() {
        return this.currentUnit;
    }

    getUnitInfo(unit = null) {
        unit = unit || this.currentUnit;
        return this.units[unit];
    }

    convertToBaseUnit(value, fromUnit = null) {
        fromUnit = fromUnit || this.currentUnit;
        const unitInfo = this.units[fromUnit];
        if (!unitInfo) return value;
        
        if (unitInfo.fractional && typeof value === 'string') {
            value = this.parseFractionalInches(value);
        }
        
        return parseFloat(value) * unitInfo.factor;
    }

    convertFromBaseUnit(value, toUnit = null) {
        toUnit = toUnit || this.currentUnit;
        const unitInfo = this.units[toUnit];
        if (!unitInfo) return value;
        
        const converted = value / unitInfo.factor;
        
        if (unitInfo.fractional) {
            return this.formatAsFractionalInches(converted);
        }
        
        return this.roundToPrecision(converted, unitInfo.decimal);
    }

    formatValue(value, unit = null, includeUnit = true) {
        unit = unit || this.currentUnit;
        const unitInfo = this.units[unit];
        if (!unitInfo) return value.toString();
        
        const converted = this.convertFromBaseUnit(value, unit);
        let formatted;
        
        if (unitInfo.fractional) {
            formatted = converted;
        } else {
            formatted = this.roundToPrecision(converted, unitInfo.decimal).toString();
        }
        
        return includeUnit ? `${formatted}${unitInfo.symbol}` : formatted;
    }

    parseValue(input, fromUnit = null) {
        fromUnit = fromUnit || this.currentUnit;
        const unitInfo = this.units[fromUnit];
        
        if (typeof input === 'string') {
            input = input.trim();
            
            // Remove unit symbols if present
            Object.values(this.units).forEach(unit => {
                input = input.replace(unit.symbol, '');
            });
            
            if (unitInfo && unitInfo.fractional) {
                return this.convertToBaseUnit(input, fromUnit);
            }
        }
        
        const value = parseFloat(input);
        return isNaN(value) ? 0 : this.convertToBaseUnit(value, fromUnit);
    }

    parseFractionalInches(input) {
        input = input.trim();
        
        // Handle mixed numbers like "1 1/2"
        const mixedMatch = input.match(/^(\d+)\s+(\d+)\/(\d+)$/);
        if (mixedMatch) {
            const whole = parseInt(mixedMatch[1]);
            const numerator = parseInt(mixedMatch[2]);
            const denominator = parseInt(mixedMatch[3]);
            return whole + (numerator / denominator);
        }
        
        // Handle fractions like "3/4"
        const fractionMatch = input.match(/^(\d+)\/(\d+)$/);
        if (fractionMatch) {
            const numerator = parseInt(fractionMatch[1]);
            const denominator = parseInt(fractionMatch[2]);
            return numerator / denominator;
        }
        
        // Handle decimals
        const decimal = parseFloat(input);
        return isNaN(decimal) ? 0 : decimal;
    }

    formatAsFractionalInches(decimal, maxDenominator = 16) {
        const whole = Math.floor(decimal);
        const fraction = decimal - whole;
        
        if (fraction < 0.001) {
            return whole === 0 ? '0' : whole.toString();
        }
        
        // Find closest fraction
        let bestNumerator = 1;
        let bestDenominator = maxDenominator;
        let bestError = Math.abs(fraction - (bestNumerator / bestDenominator));
        
        for (let denominator = 2; denominator <= maxDenominator; denominator++) {
            const numerator = Math.round(fraction * denominator);
            if (numerator === 0) continue;
            
            const error = Math.abs(fraction - (numerator / denominator));
            if (error < bestError) {
                bestError = error;
                bestNumerator = numerator;
                bestDenominator = denominator;
            }
        }
        
        // Reduce fraction
        const gcd = this.greatestCommonDivisor(bestNumerator, bestDenominator);
        bestNumerator /= gcd;
        bestDenominator /= gcd;
        
        const fractionStr = `${bestNumerator}/${bestDenominator}`;
        
        if (whole === 0) {
            return fractionStr;
        } else {
            return `${whole} ${fractionStr}`;
        }
    }

    greatestCommonDivisor(a, b) {
        return b === 0 ? a : this.greatestCommonDivisor(b, a % b);
    }

    roundToPrecision(value, decimals) {
        const multiplier = Math.pow(10, decimals);
        return Math.round(value * multiplier) / multiplier;
    }

    updateUI() {
        const unitsElement = document.getElementById('units');
        if (unitsElement) {
            const unitInfo = this.getUnitInfo();
            unitsElement.textContent = `Units: ${unitInfo.symbol}`;
        }
    }

    dispatchUnitChangeEvent() {
        const event = new CustomEvent('unitsChange', {
            detail: {
                unit: this.currentUnit,
                unitInfo: this.getUnitInfo()
            }
        });
        document.dispatchEvent(event);
    }

    getAvailableUnits() {
        return Object.keys(this.units);
    }

    getUnitDisplayName(unit) {
        const unitInfo = this.units[unit];
        return unitInfo ? unitInfo.name : unit;
    }
}