/**
 * @reference http://www.oit.ucsb.edu/committees/CNC-BEG/vlan_id.asp
 */

import rangeFnFactory from './range-fn-factory'

const max = 4095
const min = 0
const reserved = [
  0,
  4095
]

/**
 * Validate value as a VLAN ID integer
 * @param {Any} value - value to validate
 * @returns {Boolean} whether or not value is valid
 */
export default rangeFnFactory(min, max, reserved)
