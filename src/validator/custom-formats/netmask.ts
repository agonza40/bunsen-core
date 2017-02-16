/**
 * @reference https://en.wikipedia.org/wiki/Subnetwork
 */

import ipv4Address from './ipv4-address'
import {ipv4AddressBits} from './utils'

/**
 * Validate value as a netmask
 * @param {Any} value - value to validate
 * @returns {Boolean} whether or not value is valid
 */
export default function (value) {
  if (!ipv4Address(value)) {
    return false
  }

  const bits = ipv4AddressBits(value)

  return /^1*0*$/.test(bits)
}
