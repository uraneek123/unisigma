from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "UniSigma Backend"
    app_env: str = "dev"
    database_url: str = "sqlite:///./unisigma.db"
    pix2text_mode: str = "formula"
    pix2text_provider: Literal["local", "cloud"] = "local"
    pix2text_cloud_api_key: str | None = None
    pix2text_cloud_base_url: str = "https://api.breezedeus.com"
    pix2text_cloud_submit_path: str = "/pix2text"
    pix2text_cloud_result_path_template: str = "/result/{task_id}"
    pix2text_cloud_language: str = "English"
    pix2text_cloud_server_type: Literal["pro", "plus", "ultra"] = "pro"
    pix2text_cloud_poll_interval_seconds: float = 2.0
    pix2text_cloud_poll_timeout_seconds: float = 90.0

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
