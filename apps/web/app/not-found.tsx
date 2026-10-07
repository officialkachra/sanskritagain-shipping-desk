import Link from "next/link";
export default function NotFound() { return <><h1>Order not found</h1><p className="muted">Check the order number, or go back to <Link href="/">all orders</Link>.</p></>; }
