'use strict'

import './typedefs'
import * as _ from 'lodash'
import {
  BunsenModel,
  BunsenValidationResult,
  BunsenDereferenceResult
} from './model-types'

import {
  addErrorResult,
  aggregateResults
} from './validator/utils'

/*
 * @typedef Params
 * @property {Object} fullSchema - the full (expanded-so-far) schema
 * @property {String} subSchemaRef - the JSON Schema reference (#/foo/bar) to the sub-section to dereference
 * @property {BunsenValidationResult[]} results - the results of validating the schema as we dereference it
 * @property {String[]} expandedRefs - a list of all references that were expanded
 * @property {String[]} nestedRefs - a list of references that were expanded within a single recusion stack
 */
export interface Params {
  fullSchema: BunsenModel
  subSchemaRef: string
  results: BunsenValidationResult[]
  expandedRefs: string[]
  nestedRefs: string[]
}
/**
 * Convert a $ref entry into a dotted path suitable for use with _.get()
 * @param {String} ref - the reference
 * @returns {String} the dotted path
 * @throws {Error} if an error is detected (invalid reference)
 */
export function getPath (ref: string): string {
  if (ref.indexOf('#/') !== 0) {
    throw new Error(`Invalid reference "${ref}" must begin with "#/"`)
  }

  return ref.split('/').slice(1).join('.')
}

/**
 * Based on what type of subSchema we're processing, recurse on its children
 * @param {Function} recurseFunc - the function to recurse on (to avoid using it before it's defined)
 * @param {Object} subSchema - the sub schema to recurse on
 * @param {Params} params - the params to give to recuseFunc
 */
export function recurse (recurseFunc: (params: Params) => void, subSchema: BunsenModel, params: Params) {
  const fullSchema = params.fullSchema
  const subSchemaRef = params.subSchemaRef
  const results = params.results
  const expandedRefs = params.expandedRefs
  const nestedRefs = params.nestedRefs

  switch (subSchema.type) {
    case 'object':
      if (subSchema.properties) {
        _.forIn(subSchema.properties, (value: BunsenModel, key: string) => {
          recurseFunc({
            fullSchema,
            subSchemaRef: `${subSchemaRef}/properties/${key}`,
            results,
            expandedRefs,
            nestedRefs
          })
        })
      }
      break

    case 'array':
      recurseFunc({
        fullSchema,
        subSchemaRef: `${subSchemaRef}/items`,
        results,
        expandedRefs,
        nestedRefs
      })
      break

    default:
      // nothing to recurse on
      break
  }
}

/**
 * Process the reference (if it exists)
 * @param {Object} subSchema - the sub schema to recurse on
 * @param {Params} params - the params to give to recuseFunc
 * @throws Error when cycle detected or on invalid path
 */
export function processRef (subSchema: BunsenModel, params: Params) {
  const ref = _.clone(subSchema.$ref)

  if (!ref) {
    return
  }

  _.defaults(params, {
    nestedRefs: []
  })

  const fullSchema = params.fullSchema
  const expandedRefs = params.expandedRefs
  const nestedRefs = params.nestedRefs

  if (_.includes(nestedRefs, ref)) {
    throw new Error(`Cycle detected trying to dereference '${ref}'`)
  }

  // make sure we don't actually update the original or parallel objects
  // will think they are cycles -- ARM
  params.nestedRefs = _.clone(nestedRefs)
  params.nestedRefs.push(ref)

  if (!_.includes(expandedRefs, ref)) {
    expandedRefs.push(ref)
  }

  const refPath = getPath(ref)
  const refObj = _.cloneDeep(_.get(fullSchema, refPath))

  if (!refObj) {
    throw new Error(`Invalid reference: '${ref}'`)
  }

  _.defaults(subSchema, refObj)
  delete subSchema.$ref
}

/*
 * Dereference the given sub schema
 * @param {Params} params - params object
 */
export function dereferenceSubSchema (params: Params) {
  const fullSchema = params.fullSchema
  const subSchemaRef = params.subSchemaRef
  const results = params.results

  let path
  try {
    path = getPath(subSchemaRef)
  } catch (e) {
    addErrorResult(results, subSchemaRef, e.message)
    return
  }

  const subSchema = _.get<BunsenModel, BunsenModel>(fullSchema, path)

  try {
    processRef(subSchema, params)
  } catch (e) {
    addErrorResult(results, `${subSchemaRef}/$ref`, e.message)
    return
  }

  recurse(dereferenceSubSchema, subSchema, params)
}

/**
 * Take a schema that may or may not include $ref keys and convert it into
 * one that does not include $ref keys
 * @param {Object} src - the source schema
 * @returns {BunsenDereferenceResult} the result of the dereference operation
 */
export function dereference (src: BunsenModel): BunsenDereferenceResult {
  const dest = _.cloneDeep(src)
  const results: BunsenValidationResult[] = []
  const expandedRefs: string[] = []

  if (src.properties) {
    _.forIn(src.properties, (value, key) => {
      dereferenceSubSchema({
        fullSchema: dest,
        subSchemaRef: `#/properties/${key}`,
        results,
        expandedRefs,
        nestedRefs: []
      })
    })
  }

  return {
    schema: dest,
    errors: aggregateResults(results).errors,
    refs: expandedRefs
  }
}
