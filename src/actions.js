import { createAction } from 'redux-actions';
import snakeCase from 'lodash/snakeCase';
import find from 'lodash/find';
import isFunction from 'lodash/isFunction';
import values from 'lodash/values';
import flatten from 'lodash/flatten';
import { normalizeMethods } from './methods';

const typePrefix = '@@redux-models/';

export function methodNameToTypes(modelName, methodName) {
  const type = `${typePrefix}${snakeCase(modelName).toUpperCase()}/${snakeCase(
    methodName
  ).toUpperCase()}`;
  return [`${type}_START`, `${type}_SUCCESS`, `${type}_ERROR`, `${type}_RESET`];
}

export function actionTypes(modelName, methods) {
  return methods.reduce((types, method) => {
    const methodName = method.name || method;
    const [start, success, error, reset] = methodNameToTypes(
      modelName,
      methodName
    );
    types[snakeCase(`${methodName}Start`).toUpperCase()] = start;
    types[snakeCase(`${methodName}`).toUpperCase()] = success;
    types[snakeCase(`${methodName}Success`).toUpperCase()] = success;
    types[snakeCase(`${methodName}Error`).toUpperCase()] = error;
    types[snakeCase(`${methodName}Reset`).toUpperCase()] = reset;
    return types;
  }, {});
}

export function createActionCreator(model, method) {
  const [start, success, failure] = methodNameToTypes(
    model.config().name,
    method.name || method
  );

  if (!isFunction(method)) {
    return createAction(success, () => method);
  }

  const startAction = createAction(start, (...params) => params);
  const successAction = createAction(
    success,
    (params, result) => params,
    (params, result) => {
      return result || null;
    }
  );
  const failureAction = createAction(
    failure,
    (params, result) => params,
    (params, error) => error
  );

  return (...params) => {
    function action(dispatch) {
      dispatch(startAction(...params));

      try {
        let result = method.call(model.actions, ...params, dispatch);

        if (result && result.then && result.catch) {
          return result
            .then(data => {
              try {
                dispatch(successAction(params, data));
              } catch (e) {
                // catch errors from components...
                console.error(e);
                throw e;
              }

              return data;
            })
            .catch(error => {
              dispatch(failureAction(params, error));
              throw error;
            });
        }

        dispatch(successAction(params, result));
        return result;
      } catch (error) {
        // catch errors from components...
        console.error(error);

        dispatch(failureAction(params, error));
        throw error;
      }
    }

    action.asyncAction = true;
    action.actionName = method.name;
    action.actionParams = params;
    action.modelName = model.config().name;

    return action;
  };
}

function createResetActionCreator(model, method) {
  const [, , , reset] = methodNameToTypes(
    model.config().name,
    method.name || method
  );
  return createAction(reset, () => method);
}

/**
 *
 * @param {Model} model
 * @return {Object}
 */
export function createActions(model) {
  const modelMethods = normalizeMethods(model.config().methods);
  const mixinsMethods = flatten(values(model._mixinsMethods)).filter(
    method => !find(modelMethods, modelMethod => modelMethod.name === method)
  );

  const modelActions = modelMethods.reduce((actions, method) => {
    return {
      ...actions,
      [method.name || method]: createActionCreator(model, method),
      [`${method.name || method}Reset`]: createResetActionCreator(model, method)
    };
  }, {});

  return {
    ...modelActions,
    ...mixinsMethods.reduce((actions, method) => {
      if (modelActions[method.name || method]) {
        return actions;
      }

      return {
        ...actions,
        [method.name || method]: createActionCreator(model, method),
        [`${method.name || method}Reset`]: createResetActionCreator(
          model,
          method
        )
      };
    }, {})
  };
}
