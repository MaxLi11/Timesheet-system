import pandas as pd

# 读取最新的Timesheet Report文件
file_path = 'Timesheet Report-20260316104428.xlsx'
df = pd.read_excel(file_path)

# 显示列名
print("Excel表的列名:")
print(df.columns.tolist())
print("\n")

# 显示前几行数据
print("前5行数据:")
print(df.head())
print("\n")

# 显示数据类型
print("数据类型:")
print(df.dtypes)
print("\n")

# 显示数据形状
print(f"数据形状: {df.shape}")
