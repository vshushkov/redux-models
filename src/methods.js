import isArray from 'lodash/isArray';
import isString from 'lodash/isString';
import isFunction from 'lodash/isFunction';

/**
 *
 * @param {*} methods
 * @return {Array}
 */
export function normalizeMethods(methods) {
  const filter = method => (isFunction(method) && method.name) || isString(method);

  if (isArray(methods)) {
    return methods.filter(filter);
  }

  return Object.keys(methods || {})
    .map((key) => methods[key])
    .filter(filter);
}

/**
 *
 * @param {Model} model
 * @return {Object}
 */
export function createMixinsMethods(model) {
  return (model.config().mixins || [])
    .filter(mixin => isFunction(mixin.createMethods))
    .reduce((mixinsMethods, mixin) => {
      const mixinMethods = mixin.createMethods(model);
      return {
        ...mixinsMethods,
        [mixin.name]: normalizeMethods(mixinMethods)
      };
    }, {});
}
