/**
 * @reference https://en.wikipedia.org/wiki/IPv4
 */

import validator from 'validator'

/**
 * Validate value as an IPv4 address
 * @param {Any} value - value to validate
 * @returns {Boolean} whether or not value is valid
 */
export default function (value) {
  try {
    return validator.isIP(value, 4)
  } catch (err) {
    return false
  }
}
