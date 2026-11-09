"""Python shopping-agent module for PayPal AgentGuard."""
from .agent import get_product_page, request_purchase, run_demo, search_products

__all__ = ["search_products", "get_product_page", "request_purchase", "run_demo"]
