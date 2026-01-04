// Automation thresholds for the smart shading system
module.exports = {
  CLOSE_SHADES: {
    TEMP_ABOVE: 30, // in Celsius
    LIGHT_ABOVE: 70, // in percentage
  },
  OPEN_SHADES: {
    TEMP_BELOW: 25, // in Celsius
    LIGHT_BELOW: 50, // in percentage
  },
};
