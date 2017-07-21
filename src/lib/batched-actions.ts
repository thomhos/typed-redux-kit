import * as Redux from 'redux'
import * as ReduxSaga from 'redux-saga'
import * as ReduxSagaEffects from 'redux-saga/effects'

declare module 'redux' {
  export interface Dispatch<S> {
    <A extends Redux.Action>(asyncAction: A | A[]): A
  }
}

declare module 'redux-saga/effects' {
  export interface Put {
    <A extends Redux.Action>(action: A[]): ReduxSagaEffects.PutEffect<A>
    resolve<A extends Redux.Action>(action: A[]): ReduxSagaEffects.PutEffect<A>
  }
}

const BatchActionType = '@@typed-redux/batched-actions'

interface BatchAction {
  type: string,
  actions: Redux.Action[]
}

export const batchable = <S, A extends Redux.Action>(reducer: (state: S, action: A | BatchAction) => S) => {
  return (state: S, action: A | BatchAction) => {
    if (action.type === BatchActionType) {
      return (action as BatchAction).actions.reduce(reducer, state)
    }
    return reducer(state, action)
  }
}

export const batchEnhancer =  <S>(sagaMiddleware: ReduxSaga.SagaMiddleware<S>): Redux.StoreEnhancer<S> => (createStore) => (reducer, preloadedState) => {
  const store = createStore(reducer, preloadedState)

  let sagaDispatcher: Redux.Dispatch<S>

  const batchDispatcher: Redux.Dispatch<any> = <A extends Redux.Action>(actionOrActions: A | A[]) => {
    let action: Redux.Action
    if (Array.isArray(actionOrActions)) {
      actionOrActions.forEach(sagaDispatcher)
      action = {
        type: BatchActionType,
        actions: actionOrActions
      } as Redux.Action
    } else {
      sagaDispatcher((actionOrActions as Redux.Action))
      action = actionOrActions as Redux.Action
    }
    return store.dispatch(action)
  }

  // Give fake dispatcher to saga
  // Now this dispatch just emitting action to saga
  // Batch Dispatcher will choose how to emit action for saga
  sagaDispatcher = sagaMiddleware({
    getState: store.getState,
    // This dispatcher will be used by saga
    dispatch: batchDispatcher
  })((a: Redux.Action) => a)

  // Replace dispatch with our one
  return {
    ...store,
    dispatch: batchDispatcher
  } as Redux.Store<S>
}
