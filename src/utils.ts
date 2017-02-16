import './typedefs'
import _ from 'lodash'

/* eslint-disable complexity */
/**
 * Check if the given model includes a required field
 * @param {Model} model - the model definition
 * @returns {Boolean} true if model or any child has a required field
 */
export function doesModelContainRequiredField (model) {
  if (Array.isArray(model)) {
    for (let i = 0, len = model.length; i < len; i++) {
      if (doesModelContainRequiredField(model[i])) {
        return true
      }
    }

    return false
  }

  if (!_.isPlainObject(model)) {
    return false
  }

  if (!_.isEmpty(model.required)) {
    return true
  }

  for (let key in model) {
    if (doesModelContainRequiredField(model[key])) {
      return true
    }
  }
}
/* eslint-enable complexity */

/**
 * Get the user-visible label from the model instance
 * @param {String} label - the label override from the view
 * @param {BunsenModel} model - the model (to get title from if present)
 * @param {String} id - the dotted refeference to this object
 * @returns {String} the user-visible label
 */
export function getLabel (label, model, id) {
  const title = model ? model.title : null
  let idLabel = (id) ? _.startCase(id.split('.').slice(-1)[0]) : ''
  idLabel = _.capitalize(idLabel.toLowerCase())
  return `${label || title || idLabel}`
}

/**
 * Convert a model reference to a proper path in the model schema
 *
 * hero.firstName => hero.attributes.firstName
 * foo.bar.baz => foo.attributes.bar.attributes.baz
 *
 * Leading or trailing '.' mess up our trivial split().join() and aren't valid anyway, so we
 * handle them specially, undefined being passed into _.get() will yield undefined, and display
 * the error we want to display when the model reference is invalid, so we return undefined
 *
 * hero. => undefined
 * .hero => undefined
 *
 * @param {String} reference - the dotted reference to the model
 * @param {String} [dependencyReference] - the dotted reference to the model dependency
 * @returns {String} the proper dotted path in the model schema (or undefined if it's a bad path)
 */
export function getModelPath (reference, dependencyReference) {
  const pattern = /^[^\.](.*[^\.])?$/ // eslint-disable-line no-useless-escape
  let path = pattern.test(reference) ? `properties.${reference.split('.').join('.properties.')}` : undefined

  if (typeof path === 'string' || path instanceof String) {
    path = path.replace(/\.properties\.(\d+)\./g, '.items.') // Replace array index with "items"
  }

  if (dependencyReference) {
    const dependencyName = dependencyReference.split('.').pop()
    const pathArr = path.split('.')
    pathArr.splice(-2, 0, 'dependencies', dependencyName)
    path = pathArr.join('.')
  }

  return path
}

/**
 * Get the sub-model for a given dotted reference
 * @param {BunsenModel} model - the starting model
 * @param {String} reference - the reference to fetch
 * @param {String} [dependencyReference] - the dotted reference to the model dependency (if any)
 * @returns {BunsenModel} the sub-model
 */
export function getSubModel (model, reference, dependencyReference) {
  const path = getModelPath(reference, dependencyReference)
  return _.get(model, path)
}

/**
 * Figure out an initial value based on existing value, initialValue, and model
 * @param {String} id - the dotted path to this value in the formValue
 * @param {Object} formValue - the existing value of the whole form
 * @param {*} initialValue - the initialValue passed in to the component
 * @param {Object} model - the model to check for a default value in
 * @param {*} defaultValue - the default value to use if no other defaults are found
 * @returns {*} the initial value
 */
export function getInitialValue (id, formValue, initialValue, model, defaultValue = '') {
  const values = [_.get(formValue, id), initialValue, model['default']]
  const value = _.find(values, (value) => value !== undefined)

  if (value !== undefined) {
    return value
  }

  return defaultValue
}

/**
 * mine an object for a value
 * @param {Object} obj the object to mine
 * @param {String} valuePath the path to the value in the object
 * @param {String} startPath - start path
 * @returns {String} the value
 */
export function findValue (obj, valuePath, startPath = '') {
  const depths = startPath.split('.')
  const valueLevels = valuePath.split('./')
  const parentLevels = valueLevels.filter((element) => element === '.')
  const valueKey = valueLevels.pop()
  const absValuePath = _.without(depths.slice(0, depths.length - parentLevels.length - 1), '', '.').join('.')
  const absValueKey = [absValuePath, valueKey].join('.').replace(/^\./, '')
  return _.get(obj, absValueKey)
}

/* eslint-disable complexity */
/**
 * finds variables in orch-style queryParam values
 * @param {Object} valueObj - the value object to mine for query values
 * @param {String} queryJSON - the stringified filter object to parse
 * @param {String} startPath - start path
 * @param {Boolean} allowEmpty - allow empty values to be represented by ''
 * @returns {String} the populated filter
 * @throws Will throw when any value at the resolved path is empty
 */
export function parseVariables (valueObj, queryJSON, startPath = '', allowEmpty = false) {
  if (!queryJSON) {
    return ''
  }

  if (queryJSON.indexOf('${') !== -1) {
    const valueVariable = queryJSON.split('${')[1].split('}')[0]
    let result = findValue(valueObj, valueVariable, startPath)

    if (result === undefined || String(result) === '') {
      if (allowEmpty) {
        result = ''
      } else {
        throw new Error(`value at ${valueVariable} is empty`)
      }
    }

    const newQueryJson = queryJSON.split('${' + valueVariable + '}').join(result)
    return parseVariables(valueObj, newQueryJson, startPath, allowEmpty)
  }

  return queryJSON
}
/* eslint-enable complexity */

/**
 * grooms the query for variables using a ${variableName} syntax and populates the values
 * @param {Object} valueObj - the value object to mine for values
 * @param {Object} query - the definition from the model schema
 * @param {String} startPath - start path
 * @returns {Object} the populated query
 */
export function populateQuery (valueObj, query, startPath = '') {
  try {
    return JSON.parse(parseVariables(valueObj, JSON.stringify(query || {}), startPath))
  } catch (err) {
    return null
  }
}

/**
 * Checks if the query object has valid values
 * @param {Object} value - form value
 * @param {Object} queryDef - query definition
 * @param {String} startPath - starting path
 * @returns {Boolean} true if valid
 */
export function hasValidQueryValues (value, queryDef, startPath) {
  // need to invert this for the next major rev since returning true is contrary to the function name
  if (!queryDef) {
    return true
  }

  const query = populateQuery(value, queryDef, startPath)
  if (!query) {
    return false
  }
  return Object.keys(query).every((key) => String(query[key]) !== '')
}
