from glob import glob
import os

from setuptools import find_packages, setup

package_name = "tc01_auto_injector"

setup(
    name=package_name,
    version="0.1.0",
    packages=find_packages(exclude=["test"]),
    data_files=[
        (
            "share/ament_index/resource_index/packages",
            ["resource/" + package_name],
        ),
        ("share/" + package_name, ["package.xml", "LICENSE"]),
        (
            os.path.join("share", package_name, "models", "tc01_wall"),
            glob("models/tc01_wall/*"),
        ),
    ],
    install_requires=["setuptools"],
    zip_safe=True,
    maintainer="MessiWu822",
    maintainer_email="messimessi19870624@qq.com",
    description="Inject the TC-01 wall obstacle into TurtleBot3 Gazebo runs",
    license="Apache-2.0",
    extras_require={
        'test': [
            "pytest",
        ],
    },
    entry_points={
        "console_scripts": [
            "tc01_auto_injector = "
            "tc01_auto_injector.auto_injector:main",
        ],
    },
)
