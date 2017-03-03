import {BunsenModel, BunsenModelSet, BunsenValidationResult} from './model-types'
import {BunsenView} from './view-types'
import * as _ from 'lodash'
import {validateValue} from './validator'
import {aggregateResults} from './validator/utils'
import {getPath} from './dereference'
import {Action, Dispatch} from 'redux'

export const CHANGE_VALUE: 'CHANGE_VALUE' = 'CHANGE_VALUE'
export const VALIDATION_RESOLVED: 'VALIDATION_RESOLVED' = 'VALIDATION_RESOLVED'
export const CHANGE_MODEL: 'SET_MODEL' = 'SET_MODEL'
export const CHANGE_VIEW: 'CHANGE_VIEW' = 'CHANGE_VIEW'

export type BunsenActionType = 'CHANGE_VALUE' | 'VALIDATION_RESOLVED' | 'SET_MODEL' | 'CHANGE_VIEW'
export interface BunsenAction extends Action {
  type: BunsenActionType
}

export function changeValue (bunsenId: string, value: any) {
  return {
    type: CHANGE_VALUE,
    bunsenId,
    value
  }
}

export function changeModel (model: BunsenModel) {
  return {
    type: CHANGE_MODEL,
    model
  }
}

export function changeView (view: BunsenView) {
  return {
    type: CHANGE_VIEW,
    view
  }
}

export function updateValidationResults (validationResult: BunsenValidationResult) {
  const errorsByInput = _.groupBy(validationResult.errors, 'path')
  const errorsFilteredToMessagesOnly = _.mapValues(
    errorsByInput,
    (fieldErrors, bunsenId) => _.map(fieldErrors, 'message')
  )
  const errorsMappedToDotNotation = _.mapKeys(errorsFilteredToMessagesOnly, (value, key) => getPath(key))

  return {
    errors: errorsMappedToDotNotation,
    type: VALIDATION_RESOLVED,
    validationResult
  }
}

function invalidPath (refPath: string) {
  console.warn(`${refPath} is not a valid path`)
  return {} as BunsenModel
}

type SchemaRefResolver = (refPath: string, resolveRef: SchemaRefResolver) => BunsenModel
function schemaFromRef (definitions: BunsenModelSet): SchemaRefResolver {
  if (definitions === undefined) {
    return function (refPath: string) {
      const schema = invalidPath(refPath)
      console.warn('"$ref" can not be used, "definitions" is not defined for this schema')
      return schema
    }
  }

  return function (refPath: string, resolveRef: SchemaRefResolver) {
    const pathStack = refPath.split('/').reverse()
    if (pathStack.pop() !== '#' || pathStack.pop() !== 'definitions') {
      return invalidPath(refPath)
    }
    const startingSchema = definitions[pathStack.pop() as string]
    if (pathStack.length <= 0) {
      return startingSchema
    }
    return getSchema(pathStack, startingSchema, resolveRef)
  }
}

function getSchema (
  pathStack: string[] | null, model: BunsenModel, resolveRef: SchemaRefResolver
): BunsenModel {
  if (model.$ref !== undefined) {
    return resolveRef(model.$ref, resolveRef)
  }
  if (pathStack === null) {
    return {} as BunsenModel
  }
  if (pathStack.length <= 0) {
    return model
  }

  if (model.properties) {
    const current = pathStack.pop() as string
    return getSchema(pathStack, model.properties[current], resolveRef)
  }

  if (model.items) { // This model is an array
    const index = pathStack.pop() // Index is useful if items is an array (treated like tuple)
    if (model.items instanceof Array) {
      return getSchema(pathStack, model.items[0], resolveRef)
    } else {
      return getSchema(pathStack, model.items, resolveRef)
    }
  }

  return {} as BunsenModel
}

function findSchema (model: BunsenModel, path: string | null, resolveRef: SchemaRefResolver): BunsenModel {
  if (model.$ref !== undefined) {
    return getSchema(null, model, resolveRef)
  } else if (path === null) {
    return model
  }

  const pathStack = path && path.split('.').reverse() || []
  return getSchema(pathStack, model, resolveRef)
}

function isObjectSchema (schema: BunsenModel): boolean {
  return schema.type === 'object' || schema.properties !== undefined
}

function findDefaults (
  value: any,
  path: string | null,
  model: BunsenModel,
  resolveRef: SchemaRefResolver,
  required: boolean
): any {
  const schema = findSchema(model, path, resolveRef)

  const schemaDefault = _.clone(schema.default)
  if (isObjectSchema(model)) { // Recursing only makes sense for objects
    let subSchemaDefaults: {[index: string]: any} = {}
    let hasDefaults = required || false
    _.forEach(schema.properties as BunsenModelSet, function (subSchema, propName: string) {
      const isRequired: boolean = schema.required === undefined ? false : _.includes(schema.required, propName)
      const defaults = findDefaults(
        value && value[propName],
        null,
        subSchema,
        resolveRef,
        isRequired
      )
      if (defaults !== undefined) {
        subSchemaDefaults[propName] = defaults
        hasDefaults = true
      }
    })
    if (hasDefaults) { // If we didn't find any defaults, we don't want to try to modify the return
      return _.defaults({}, schemaDefault, subSchemaDefaults)
    }
  } else if (value !== undefined) {
    return value
  }
  return schemaDefault
}

function isEmptyValue (value: any) {
  return [undefined, null].indexOf(value) !== -1 ||
  (_.isObject(value) && Object.keys(value).length === 0) // Check if empty object
}

function dispatchUpdatedResults (dispatch: Dispatch<BunsenAction>, results: BunsenValidationResult[]) {
  const aggregatedResult = aggregateResults(results)
  // TODO: Dispatch an err action
  dispatch(updateValidationResults(aggregatedResult))
}

/*eslint-disable complexity */
/**
 * Validate action
 * @param {String} bunsenId - bunsen ID of what changed
 * @param {Object} inputValue - value of what changed
 * @param {Object} renderModel - bunsen model
 * @param {Array<Function>} validators - custom validators
 * @param {Function} [all=Promise.all] - framework specific Promise.all method
 * @param {Boolean} [forceValidation=false] - whether or not to force validation
 * @returns {Function} Function to asynchronously validate
 */
export function validate (
  bunsenId: string,
  inputValue: any,
  renderModel: BunsenModel,
  validators: ((...args: any[]) => any)[],
  all = Promise.all,
  forceValidation: boolean = false
) {
  return function (dispatch: Dispatch<BunsenAction>, getState: () => any) {
    let formValue = getState().value

    const isInputValueEmpty = isEmptyValue(inputValue)

    const previousValue = _.get(formValue, bunsenId)

    // If an empty value has been provided and there is no previous value then
    // make sure to apply defaults from the model
    if (isInputValueEmpty && previousValue === undefined && renderModel.definitions !== undefined) {
      const resolveRef = schemaFromRef(renderModel.definitions)
      const defaultValue = findDefaults(inputValue, bunsenId, renderModel, resolveRef, false)
      if (bunsenId === null && defaultValue === undefined) {
        inputValue = {}
      } else if (defaultValue !== undefined) {
        inputValue = defaultValue
      }
    }

    // if the value never changed, no need to update and validate (unless consumer
    // is forcing validation again)
    if (!forceValidation && _.isEqual(inputValue, previousValue)) {
      return
    }

    dispatch(changeValue(bunsenId, inputValue))

    // We must lookup the formValue again in order for the validation results to
    // be run on the post-change value rather than the pre-change value
    formValue = getState().value

    const result: BunsenValidationResult = validateValue(formValue, renderModel)

    const promises:any[] = []
    validators.forEach((validator) => {
      promises.push(validator(formValue))
    })

    // Promise.all fails in Node when promises array is empty
    if (promises.length === 0) {
      dispatchUpdatedResults(dispatch, [result])
      return
    }

    all(promises)
      .then((snapshots) => {
        const results: BunsenValidationResult[] = _.map<any, BunsenValidationResult>(snapshots, 'value')
        results.push(result)
        dispatchUpdatedResults(dispatch, results)
      })
  }
}
