export type PortOk<T> = { ok: true; value: T };
export type PortErr<E> = { ok: false; error: E };
export type PortResult<T, E> = PortOk<T> | PortErr<E>;

export const portOk = <T>(value: T): PortOk<T> => ({ ok: true, value });
export const portErr = <E>(error: E): PortErr<E> => ({ ok: false, error });
